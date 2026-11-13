// group-the-reports: a workflow. Code decides every step; the model only reads messy text.
import { ask } from "../config/llm";
import { EXTRACT } from "./prompts";
import {
  addressKey,
  type CustomerRow,
  openOutage,
  openOutageOn,
  type ReportRow,
  type Storm,
  type WaitingReport,
} from "./storm-state";

type ReadReport = { customer: CustomerRow | undefined; kind: "outage" | "not-outage" };

// What the model pulls out of a report. Any field can be missing when the model misreads.
type ExtractedReport = { account?: string; number?: number; street?: string; kind?: string };

// The model is asked for one JSON object. Read the part between the first { and the last }.
export function parseJsonReply<Shape>(text: string, fallback: Shape): Shape {
  const jsonPart = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    return JSON.parse(jsonPart) as Shape;
  } catch {
    return fallback;
  }
}

function findCustomer(storm: Storm, extracted: ExtractedReport): CustomerRow | undefined {
  const byAccount = extracted.account && storm.customerById.get(extracted.account);
  if (byAccount) return byAccount;
  if (!(extracted.number && extracted.street)) return undefined;
  return storm.customerByAddress.get(addressKey(extracted.number, String(extracted.street)));
}

async function readReport(storm: Storm, report: ReportRow): Promise<ReadReport> {
  // A smart meter alarm already names its customer, so it needs no model.
  if (report.channel === "meter") {
    return { customer: storm.customerById.get(report.customerHint as string), kind: "outage" };
  }
  const prompt = `Report ${report.id} via ${report.channel}: ${report.text}`;
  const context = { ledger: storm.files.ledger, run: storm.run, purpose: "group-the-reports" };
  const reply = await ask({ role: "fast", system: EXTRACT, prompt }, context);
  const extracted = parseJsonReply<ExtractedReport>(reply.text, {});
  const kind = extracted.kind === "not-outage" ? "not-outage" : "outage";
  return { customer: findCustomer(storm, extracted), kind };
}

// Put each report on an outage that is already open on the home's device, or the recloser above it.
function attachToOpenOutages(storm: Storm) {
  const waiting = storm.waitingReports;
  for (let i = waiting.length - 1; i >= 0; i--) {
    const { report, customer } = waiting[i];
    const parent = storm.parentOf.get(customer.device);
    let outage = openOutageOn(storm, customer.device);
    if (!outage && parent) outage = openOutageOn(storm, parent);
    if (outage && !outage.restoredAt) {
      storm.linkReport.run(report, outage.id, customer.id, "workflow");
      waiting.splice(i, 1);
    }
  }
}

function linkAndStopWaiting(storm: Storm, waiting: WaitingReport, outageId: string) {
  storm.linkReport.run(waiting.report, outageId, waiting.customer.id, "workflow");
  storm.waitingReports.splice(storm.waitingReports.indexOf(waiting), 1);
}

function groupByFeeder(storm: Storm): Map<string, WaitingReport[]> {
  const byFeeder = new Map<string, WaitingReport[]>();
  for (const waiting of storm.waitingReports) {
    const feeder = storm.feederOf.get(waiting.customer.device) as string;
    byFeeder.set(feeder, [...(byFeeder.get(feeder) ?? []), waiting]);
  }
  return byFeeder;
}

// The number of different homes on one device that are waiting.
function homesOn(waitingOnFeeder: WaitingReport[], device: string): number {
  const onDevice = waitingOnFeeder.filter((waiting) => waiting.customer.device === device);
  return new Set(onDevice.map((waiting) => waiting.customer.id)).size;
}

// A whole feeder is out when two homes on its trunk report, or three of its branches do.
// Returns true when it opened an outage on the feeder.
function openFeederOutage(storm: Storm, feeder: string, waitingOnFeeder: WaitingReport[]): boolean {
  const recloser = `R-${feeder}`;
  const devices = [...new Set(waitingOnFeeder.map((waiting) => waiting.customer.device))];
  const trunkHomes = homesOn(waitingOnFeeder, recloser);
  const branches = devices.filter((device) => {
    return device.startsWith("FU-") && homesOn(waitingOnFeeder, device) >= 1;
  }).length;
  const wholeFeederOut = trunkHomes >= 2 || branches >= 3;
  if (openOutageOn(storm, recloser) || !wholeFeederOut) return false;

  let reason = `${branches} branches report`;
  if (trunkHomes >= 2) reason = `${trunkHomes} homes on the feeder trunk report`;
  const outageId = openOutage(storm, recloser, reason);
  for (const waiting of waitingOnFeeder) linkAndStopWaiting(storm, waiting, outageId);
  return true;
}

// A branch is out when two of its homes report.
function openBranchOutages(storm: Storm, waitingOnFeeder: WaitingReport[]) {
  const devices = [...new Set(waitingOnFeeder.map((waiting) => waiting.customer.device))];
  for (const device of devices) {
    const homes = homesOn(waitingOnFeeder, device);
    if (!device.startsWith("FU-") || homes < 2 || openOutageOn(storm, device)) continue;
    const outageId = openOutage(storm, device, `${homes} homes on the branch report`);
    const onBranch = waitingOnFeeder.filter((waiting) => waiting.customer.device === device);
    for (const waiting of onBranch) linkAndStopWaiting(storm, waiting, outageId);
  }
}

// Read the reports that arrived in this tick, then attach them to outages or open new ones.
export async function groupTheReports(storm: Storm, freshReports: ReportRow[]) {
  const readReports = await Promise.all(freshReports.map((report) => readReport(storm, report)));
  freshReports.forEach((report, index) => {
    const { customer, kind } = readReports[index];
    if (!customer) storm.linkReport.run(report.id, null, null, "workflow:unmatched");
    else if (kind === "not-outage") {
      storm.linkReport.run(report.id, null, customer.id, "workflow:not-outage");
    } else storm.waitingReports.push({ report: report.id, customer });
  });
  attachToOpenOutages(storm);
  for (const [feeder, waitingOnFeeder] of groupByFeeder(storm)) {
    if (openFeederOutage(storm, feeder, waitingOnFeeder)) continue;
    openBranchOutages(storm, waitingOnFeeder);
  }
}
