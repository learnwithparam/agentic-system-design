// Everything one storm night shares: the OMS, the clock, the network and the customers.
// Each job of the desk (group-the-reports.ts, plan-the-crews.ts, write-the-customer-updates.ts)
// reads and changes this one object.

import type { Database, Statement } from "bun:sqlite";
import { appendFileSync } from "node:fs";
import { withSnakeCaseNames } from "../world/lib/field-names";
import { open, reset, type StatePaths, seed } from "../world/lib/oms";
import type { TrueOutage } from "../world/lib/types";

// The OMS columns are snake_case. "AS" gives each one the camelCase name the code uses.
export const OUTAGE_COLUMNS =
  "id, device, opened_at AS openedAt, status, crew, assigned_at AS assignedAt, etr, " +
  "restored_at AS restoredAt, closed_at AS closedAt";

export type Outage = {
  id: string;
  device: string;
  openedAt: number;
  status: string;
  crew: string | null;
  assignedAt: number | null;
  etr: number | null;
  restoredAt: number | null;
  closedAt: number | null;
};

export type CustomerRow = {
  id: string;
  number: number;
  street: string;
  device: string;
  smartMeter: number;
  critical: string | null;
  name: string | null;
};

export type ReportRow = {
  id: string;
  at: number;
  channel: string;
  customerHint: string | null;
  text: string;
};

// A report that names a dark home but is not on an outage yet.
export type WaitingReport = { report: string; customer: CustomerRow };

export type Storm = {
  db: Database;
  files: StatePaths;
  run: string;
  now: number;
  log: (line: string) => void;
  parentOf: Map<string, string | null>;
  feederOf: Map<string, string>;
  failureOn: Map<string, TrueOutage>;
  trueOutages: TrueOutage[];
  customers: CustomerRow[];
  customerById: Map<string, CustomerRow>;
  customerByAddress: Map<string, CustomerRow>;
  reports: ReportRow[];
  repairedDevices: Set<string>;
  hasPower: Map<string, boolean>;
  outagesOpened: number;
  waitingReports: WaitingReport[];
  assignmentKeys: Set<string>;
  crewDoneAt: Map<string, number>;
  addMeterRead: Statement;
  linkReport: Statement;
};

export const addressKey = (houseNumber: unknown, street: string) =>
  `${houseNumber}|${street.toLowerCase()}`;

function readCustomers(db: Database): CustomerRow[] {
  const sql =
    "SELECT id, number, street, device, smart_meter AS smartMeter, critical, name FROM customers";
  return db.query(sql).all() as CustomerRow[];
}

function readReports(db: Database): ReportRow[] {
  const sql =
    "SELECT id, at, channel, customer_hint AS customerHint, text FROM reports ORDER BY at, id";
  return db.query(sql).all() as ReportRow[];
}

// Seed a fresh OMS in the folder and gather what the night needs to know.
export function startStorm(dir: string, log: (line: string) => void): Storm {
  const files = reset(dir);
  const db = open(dir);
  const { devices } = seed.network();
  const trueOutages = seed.truth().outages;
  const customers = readCustomers(db);
  return {
    db,
    files,
    run: `run-${Date.now().toString(36)}`,
    now: 0,
    log,
    parentOf: new Map(devices.map((device) => [device.id, device.parent])),
    feederOf: new Map(devices.map((device) => [device.id, device.feeder])),
    failureOn: new Map(trueOutages.map((outage) => [outage.device, outage])),
    trueOutages,
    customers,
    customerById: new Map(customers.map((customer) => [customer.id, customer])),
    customerByAddress: new Map(customers.map((row) => [addressKey(row.number, row.street), row])),
    reports: readReports(db),
    repairedDevices: new Set(),
    hasPower: new Map(),
    outagesOpened: 0,
    waitingReports: [],
    assignmentKeys: new Set(),
    crewDoneAt: new Map(),
    addMeterRead: db.prepare("INSERT INTO meter_reads VALUES (?, ?, ?)"),
    linkReport: db.prepare("INSERT OR REPLACE INTO report_links VALUES (?, ?, ?, ?)"),
  };
}

// "+ 45 min": the storm clock, in minutes since the storm began.
export const clock = (minutes: number) => `+${String(minutes).padStart(3, " ")} min`;

// Write one line to world/state/events.jsonl. The file uses snake_case names.
export function recordEvent(storm: Storm, event: Record<string, unknown>) {
  const line = JSON.stringify(withSnakeCaseNames({ run: storm.run, ...event }));
  appendFileSync(storm.files.events, `${line}\n`);
}

// The customers fed by a device: on it, or on a fuse just below it.
export function customersBehind(storm: Storm, device: string): CustomerRow[] {
  return storm.customers.filter((customer) => {
    return customer.device === device || storm.parentOf.get(customer.device) === device;
  });
}

export function allOutages(storm: Storm): Outage[] {
  return storm.db.query(`SELECT ${OUTAGE_COLUMNS} FROM outages ORDER BY id`).all() as Outage[];
}

export function openOutageOn(storm: Storm, device: string): Outage | null {
  const sql = `SELECT ${OUTAGE_COLUMNS} FROM outages WHERE device = ? AND closed_at IS NULL`;
  return storm.db.query(sql).get(device) as Outage | null;
}

// Open a new outage in the OMS and say why.
export function openOutage(storm: Storm, device: string, reason: string): string {
  storm.outagesOpened += 1;
  const id = `OUT-${String(storm.outagesOpened).padStart(3, "0")}`;
  const sql = "INSERT INTO outages (id, device, opened_at, status) VALUES (?, ?, ?, 'waiting')";
  storm.db.run(sql, [id, device, storm.now]);
  recordEvent(storm, {
    at: storm.now,
    kind: "workflow",
    tool: "oms_open_outage",
    by: "workflow",
    args: { outage: id, device },
    result: reason,
  });
  storm.log(`  ${clock(storm.now)}  opened ${id} on ${device} (${reason})`);
  return id;
}

// Smart meters behind a device that report no power right now.
export function darkMetersBehind(storm: Storm, device: string): CustomerRow[] {
  const behind = customersBehind(storm, device);
  return behind.filter((customer) => {
    return customer.smartMeter && storm.hasPower.get(customer.id) === false;
  });
}
