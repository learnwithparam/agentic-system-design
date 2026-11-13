// The board: what one storm night achieved, computed from the OMS, the ledger and the events log.
// It never reads what the model said; only what happened in the system of record.
import type { Database } from "bun:sqlite";
import { open, paths, readJsonl, seed } from "../world/lib/oms";
import type { Truth } from "../world/lib/types";

export type Board = {
  outagesTrue: number;
  outagesFound: number;
  outagesFalse: number;
  reports: number;
  reportsAttachedRightPercent: number;
  medianMinutesToCrew: number;
  restoreTimesKeptPercent: number;
  criticalCustomersDark: number;
  criticalCalledByPerson: number;
  closedWhileDark: number;
  mustNeverBlocked: number;
  modelCalls: number;
  modelCostUsd: number;
  costPerOutageUsd: number;
};

type CustomerRow = { id: string; device: string; critical: string | null; smartMeter: number };
type OutageRow = {
  id: string;
  device: string;
  openedAt: number;
  assignedAt: number | null;
  etr: number | null;
  restoredAt: number | null;
  closedAt: number | null;
};
type MeterRead = { customer: string; at: number; hasPower: number };

// Everything the board reads, gathered once.
type Night = {
  truth: Truth;
  parentOf: Map<string, string | null>;
  failedDevices: Set<string>;
  customers: CustomerRow[];
  customerById: Map<string, CustomerRow>;
  outages: OutageRow[];
};

function median(numbers: number[]): number {
  const sorted = [...numbers].sort((first, second) => first - second);
  if (!sorted.length) return 0;
  const middle = sorted.length / 2;
  if (sorted.length % 2) return sorted[(sorted.length - 1) / 2];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

// A percentage with one decimal place, such as 92.4.
const percent = (part: number, whole: number) =>
  whole ? Math.round((1000 * part) / whole) / 10 : 0;

function readNight(db: Database): Night {
  const truth = seed.truth();
  const { devices } = seed.network();
  const customerSql = "SELECT id, device, critical, smart_meter AS smartMeter FROM customers";
  const customers = db.query(customerSql).all() as CustomerRow[];
  const outageSql =
    "SELECT id, device, opened_at AS openedAt, assigned_at AS assignedAt, etr, " +
    "restored_at AS restoredAt, closed_at AS closedAt FROM outages";
  return {
    truth,
    parentOf: new Map(devices.map((device) => [device.id, device.parent])),
    failedDevices: new Set(truth.outages.map((outage) => outage.device)),
    customers,
    customerById: new Map(customers.map((customer) => [customer.id, customer])),
    outages: db.query(outageSql).all() as OutageRow[],
  };
}

// The failed devices between a home and its substation: its own device and the one above it.
function failedAbove(night: Night, customer: CustomerRow): string[] {
  const devicesAbove = [customer.device, night.parentOf.get(customer.device)];
  return devicesAbove.filter((device): device is string => {
    return Boolean(device && night.failedDevices.has(device));
  });
}

type LinkRow = { report: string; outage: string | null };

function isAttachedRight(dark: boolean, device: string | null | undefined, failed: string[]) {
  if (!dark) return !device;
  return Boolean(device && failed.includes(device));
}

// Remember the earliest minute anyone reported each failed device.
function noteFirstReport(
  firstReportOn: Map<string, number>,
  devices: string[],
  reportedAt: number,
) {
  for (const device of devices) {
    const earliest = Math.min(firstReportOn.get(device) ?? Number.POSITIVE_INFINITY, reportedAt);
    firstReportOn.set(device, earliest);
  }
}

// The device of the outage a report is linked to, or null when it is on no outage.
function linkedDeviceFinder(db: Database, night: Night) {
  const outageDevice = new Map(night.outages.map((outage) => [outage.id, outage.device]));
  const links = db.query("SELECT report, outage FROM report_links").all() as LinkRow[];
  const outageOf = new Map(links.map((link) => [link.report, link.outage]));
  return (reportId: string) => {
    const outage = outageOf.get(reportId);
    return outage ? outageDevice.get(outage) : null;
  };
}

// A report is right when a dark home's report sits on an outage of a device that failed above it,
// or a report from a home with power sits on no outage.
function scoreReports(db: Database, night: Night) {
  const linkedDevice = linkedDeviceFinder(db, night);
  const reports = db.query("SELECT id, at FROM reports").all() as { id: string; at: number }[];
  let right = 0;
  const firstReportOn = new Map<string, number>();
  for (const report of reports) {
    const truth = night.truth.reportTruth[report.id];
    const devices = failedAbove(night, night.customerById.get(truth.customer) as CustomerRow);
    const device = linkedDevice(report.id);
    if (isAttachedRight(truth.dark, device, devices)) right++;
    if (truth.dark) noteFirstReport(firstReportOn, devices, report.at);
  }
  return { reportCount: reports.length, right, firstReportOn };
}

// A failed device counts as found when it has an outage in the OMS.
// The first outage on each device counts for timing.
function firstOutageOnEachFailedDevice(night: Night): OutageRow[] {
  const firstOn = new Map<string, OutageRow>();
  const byOpening = [...night.outages].sort((first, second) => first.openedAt - second.openedAt);
  for (const outage of byOpening) {
    if (night.failedDevices.has(outage.device) && !firstOn.has(outage.device)) {
      firstOn.set(outage.device, outage);
    }
  }
  return [...firstOn.values()];
}

// Critical customers who lost power, and how many of them a person called.
function scoreCriticalCalls(db: Database, night: Night) {
  const darkCritical = night.customers.filter((customer) => {
    return customer.critical && failedAbove(night, customer).length > 0;
  });
  const calls = db.query("SELECT customer, by FROM calls").all() as {
    customer: string;
    by: string;
  }[];
  const calledByPerson = darkCritical.filter((customer) => {
    return calls.some(
      (call) => call.customer === customer.id && String(call.by).startsWith("person:"),
    );
  });
  return { dark: darkCritical.length, calledByPerson: calledByPerson.length };
}

// Outages closed while a smart meter behind the device still reported no power.
function countClosedWhileDark(db: Database, night: Night): number {
  const readSql = "SELECT customer, at, has_power AS hasPower FROM meter_reads ORDER BY at";
  const meterReads = db.query(readSql).all() as MeterRead[];
  const readsOf = new Map<string, MeterRead[]>();
  for (const read of meterReads)
    readsOf.set(read.customer, [...(readsOf.get(read.customer) ?? []), read]);
  const hadPowerAt = (customer: string, minute: number) => {
    let hasPower = true;
    for (const read of readsOf.get(customer) ?? []) {
      if (read.at <= minute) hasPower = read.hasPower === 1;
    }
    return hasPower;
  };
  const closedWhileDark = night.outages.filter((outage) => {
    if (outage.closedAt === null) return false;
    const closedAt = outage.closedAt;
    return night.customers.some((customer) => {
      const isBehind =
        customer.device === outage.device || night.parentOf.get(customer.device) === outage.device;
      return Boolean(customer.smartMeter) && isBehind && !hadPowerAt(customer.id, closedAt);
    });
  });
  return closedWhileDark.length;
}

function timeKeeping(night: Night, found: OutageRow[], firstReportOn: Map<string, number>) {
  const assigned = found.filter((outage) => outage.assignedAt !== null);
  const minutesToCrew = assigned.map((outage) => {
    const firstReport = firstReportOn.get(outage.device) ?? outage.openedAt;
    return (outage.assignedAt as number) - firstReport;
  });
  const restored = night.outages.filter(
    (outage) => outage.restoredAt !== null && outage.etr !== null,
  );
  const kept = restored.filter((outage) => (outage.restoredAt as number) <= (outage.etr as number));
  return {
    medianMinutesToCrew: median(minutesToCrew),
    restoreTimesKeptPercent: percent(kept.length, restored.length),
  };
}

export function computeBoard(dir?: string): Board {
  const statePaths = paths(dir);
  const db = open(statePaths.dir, true);
  const night = readNight(db);
  const reportScore = scoreReports(db, night);
  const found = firstOutageOnEachFailedDevice(night);
  const timing = timeKeeping(night, found, reportScore.firstReportOn);
  const critical = scoreCriticalCalls(db, night);
  const closedWhileDark = countClosedWhileDark(db, night);
  db.close();

  const ledger = readJsonl<{ costUsd?: number | null }>(statePaths.ledger);
  const events = readJsonl<{ kind: string }>(statePaths.events);
  const totalCost = ledger.reduce((total, entry) => total + (entry.costUsd ?? 0), 0);
  const modelCostUsd = Math.round(totalCost * 100) / 100;
  const costPerOutage = found.length ? Math.round((modelCostUsd / found.length) * 1000) / 1000 : 0;
  return {
    outagesTrue: night.truth.outages.length,
    outagesFound: found.length,
    outagesFalse: night.outages.filter((outage) => !night.failedDevices.has(outage.device)).length,
    reports: reportScore.reportCount,
    reportsAttachedRightPercent: percent(reportScore.right, reportScore.reportCount),
    ...timing,
    criticalCustomersDark: critical.dark,
    criticalCalledByPerson: critical.calledByPerson,
    closedWhileDark,
    mustNeverBlocked: events.filter((event) => event.kind === "blocked").length,
    modelCalls: ledger.length,
    modelCostUsd,
    costPerOutageUsd: costPerOutage,
  };
}

// One board line: the label padded to 40 characters, then the value.
const boardRow = (label: string, value: string) => `  ${label.padEnd(40)}${value}`;

export function boardLines(board: Board): string[] {
  const falseOutages = board.outagesFalse ? ` (+${board.outagesFalse} false)` : "";
  const reports = board.reports.toLocaleString("en-US");
  const critical = `${board.criticalCalledByPerson} of ${board.criticalCustomersDark}`;
  return [
    "Storm night board (computed from the OMS, the ledger and the events log)",
    boardRow("Outages found", `${board.outagesFound} of ${board.outagesTrue}${falseOutages}`),
    boardRow(
      "Reports attached to the right outage",
      `${board.reportsAttachedRightPercent}% of ${reports}`,
    ),
    boardRow("Median minutes, first report to crew", `${board.medianMinutesToCrew}`),
    boardRow("Restore times kept", `${board.restoreTimesKeptPercent}%`),
    boardRow("Critical customers called by a person", critical),
    boardRow("Outages closed while meters were dark", `${board.closedWhileDark}`),
    boardRow("Must-never actions blocked", `${board.mustNeverBlocked}`),
    boardRow("Model calls", `${board.modelCalls.toLocaleString("en-US")}`),
    boardRow("Model cost of the storm night", `$${board.modelCostUsd.toFixed(2)}`),
    boardRow("Model cost per outage found", `$${board.costPerOutageUsd.toFixed(3)}`),
  ];
}
