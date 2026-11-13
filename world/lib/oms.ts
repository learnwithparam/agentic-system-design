// The outage management system (OMS): Copperbeck's system of record, a SQLite file.
// The state folder is world/state/ unless WORLD_STATE names another one.
// The checks use a fresh folder for each run.
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { withCamelCaseNames } from "./field-names";
import type { Crew, Customer, Network, Report, Truth } from "./types";

export const WORLD = join(import.meta.dir, "..");
const SEED_FOLDER = join(WORLD, "seed");

export function stateDir(): string {
  const chosenFolder = process.env.WORLD_STATE;
  if (!chosenFolder) return join(WORLD, "state");
  if (isAbsolute(chosenFolder)) return chosenFolder;
  return join(process.cwd(), chosenFolder);
}

export type StatePaths = { dir: string; oms: string; ledger: string; events: string };

export const paths = (dir = stateDir()): StatePaths => ({
  dir,
  oms: join(dir, "oms.db"),
  ledger: join(dir, "ledger.jsonl"),
  events: join(dir, "events.jsonl"),
});

function readSeedFile<Shape>(fileName: string): Shape {
  const text = readFileSync(join(SEED_FOLDER, fileName), "utf8");
  return withCamelCaseNames<Shape>(JSON.parse(text));
}

function readSeedReports(): Report[] {
  const text = readFileSync(join(SEED_FOLDER, "reports.jsonl"), "utf8");
  const lines = text.trim().split("\n");
  return lines.map((line) => withCamelCaseNames<Report>(JSON.parse(line)));
}

export const seed = {
  network: () => readSeedFile<Network>("network.json"),
  customers: () => readSeedFile<Customer[]>("customers.json"),
  crews: () => readSeedFile<Crew[]>("crews.json"),
  reports: readSeedReports,
  truth: () => readSeedFile<Truth>("truth.json"),
};

export const SCHEMA = `
CREATE TABLE devices (
  id TEXT PRIMARY KEY, kind TEXT, feeder TEXT, parent TEXT, energized INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE customers (
  id TEXT PRIMARY KEY, number INTEGER, street TEXT, device TEXT, smart_meter INTEGER,
  critical TEXT, name TEXT
);
CREATE TABLE meter_reads (customer TEXT, at INTEGER, has_power INTEGER);
CREATE TABLE crews (
  id TEXT PRIMARY KEY, depot TEXT, skills TEXT, free_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE reports (id TEXT PRIMARY KEY, at INTEGER, channel TEXT, customer_hint TEXT, text TEXT);
CREATE TABLE outages (
  id TEXT PRIMARY KEY, device TEXT, opened_at INTEGER, status TEXT, crew TEXT,
  assigned_at INTEGER, etr INTEGER, restored_at INTEGER, closed_at INTEGER
);
CREATE TABLE report_links (report TEXT PRIMARY KEY, outage TEXT, customer TEXT, by TEXT);
CREATE TABLE calls (outage TEXT, customer TEXT, at INTEGER, by TEXT, etr_told INTEGER);
CREATE TABLE notices (outage TEXT, at INTEGER, customers INTEGER, text TEXT);
`;

function addDevices(db: Database) {
  const sql = "INSERT INTO devices (id, kind, feeder, parent) VALUES (?, ?, ?, ?)";
  const addDevice = db.prepare(sql);
  for (const device of seed.network().devices) {
    addDevice.run(device.id, device.kind, device.feeder, device.parent);
  }
}

function addCustomers(db: Database) {
  const addCustomer = db.prepare("INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?, ?)");
  for (const customer of seed.customers()) {
    const { id, number, street, device, critical } = customer;
    const smartMeter = customer.smartMeter ? 1 : 0;
    addCustomer.run(id, number, street, device, smartMeter, critical, customer.name ?? null);
  }
}

function addCrews(db: Database) {
  const addCrew = db.prepare("INSERT INTO crews (id, depot, skills) VALUES (?, ?, ?)");
  for (const crew of seed.crews()) addCrew.run(crew.id, crew.depot, crew.skills.join(","));
}

function addReports(db: Database) {
  const addReport = db.prepare("INSERT INTO reports VALUES (?, ?, ?, ?, ?)");
  for (const report of seed.reports()) {
    addReport.run(report.id, report.at, report.channel, report.customerHint, report.text);
  }
}

// Copy every seed file into the empty tables in one transaction, which is much faster.
function fillTables(db: Database) {
  const fillAll = db.transaction(() => {
    addDevices(db);
    addCustomers(db);
    addCrews(db);
    addReports(db);
  });
  fillAll();
}

// Wipe the state folder and build a fresh OMS from world/seed/.
export function reset(dir = stateDir()): StatePaths {
  const statePaths = paths(dir);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const db = new Database(statePaths.oms, { create: true });
  db.exec("PRAGMA journal_mode = DELETE; PRAGMA synchronous = OFF;");
  db.exec(SCHEMA);
  fillTables(db);
  db.close();
  writeFileSync(statePaths.ledger, "");
  writeFileSync(statePaths.events, "");
  return statePaths;
}

export function open(dir = stateDir(), readonly = false): Database {
  const statePaths = paths(dir);
  if (!existsSync(statePaths.oms)) {
    throw new Error(`No OMS at ${statePaths.oms}. Run: bun run world reset`);
  }
  const db = new Database(statePaths.oms, readonly ? { readonly: true } : undefined);
  // Writes skip the wait for the disk: a storm run is fast, and a crash only loses a practice run.
  if (!readonly) db.exec("PRAGMA synchronous = OFF;");
  return db;
}

export function tables(dir = stateDir()): string[] {
  const db = open(dir, true);
  const query = db.query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
  const rows = query.all() as { name: string }[];
  db.close();
  return rows.map((row) => row.name);
}

// Read a file with one JSON object on each line. Names come back in camelCase.
export function readJsonl<Shape>(file: string): Shape[] {
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
  return lines.map((line) => withCamelCaseNames<Shape>(JSON.parse(line)));
}
