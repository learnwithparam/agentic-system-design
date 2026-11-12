// The outage management system (OMS): Copperbeck's system of record, a SQLite file.
// The state folder is world/state/ unless WORLD_STATE names another one (the checks use fresh folders).
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { Crew, Customer, Network, Report, Truth } from "./types";

export const WORLD = join(import.meta.dir, "..");
const SEED = join(WORLD, "seed");
export const stateDir = () => {
  const s = process.env.WORLD_STATE;
  return s ? (isAbsolute(s) ? s : join(process.cwd(), s)) : join(WORLD, "state");
};
export const paths = (dir = stateDir()) => ({
  dir,
  oms: join(dir, "oms.db"),
  ledger: join(dir, "ledger.jsonl"),
  events: join(dir, "events.jsonl"),
});

const json = <T>(f: string): T => JSON.parse(readFileSync(join(SEED, f), "utf8")) as T;
export const seed = {
  network: () => json<Network>("network.json"),
  customers: () => json<Customer[]>("customers.json"),
  crews: () => json<Crew[]>("crews.json"),
  reports: () => readFileSync(join(SEED, "reports.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as Report),
  truth: () => json<Truth>("truth.json"),
};

export const SCHEMA = `
CREATE TABLE devices (id TEXT PRIMARY KEY, kind TEXT, feeder TEXT, parent TEXT, energized INTEGER NOT NULL DEFAULT 1);
CREATE TABLE customers (id TEXT PRIMARY KEY, number INTEGER, street TEXT, device TEXT, smart_meter INTEGER, critical TEXT, name TEXT);
CREATE TABLE meter_reads (customer TEXT, at INTEGER, has_power INTEGER);
CREATE TABLE crews (id TEXT PRIMARY KEY, depot TEXT, skills TEXT, free_at INTEGER NOT NULL DEFAULT 0);
CREATE TABLE reports (id TEXT PRIMARY KEY, at INTEGER, channel TEXT, customer_hint TEXT, text TEXT);
CREATE TABLE outages (id TEXT PRIMARY KEY, device TEXT, opened_at INTEGER, status TEXT, crew TEXT, assigned_at INTEGER, etr INTEGER, restored_at INTEGER, closed_at INTEGER);
CREATE TABLE report_links (report TEXT PRIMARY KEY, outage TEXT, customer TEXT, by TEXT);
CREATE TABLE calls (outage TEXT, customer TEXT, at INTEGER, by TEXT, etr_told INTEGER);
CREATE TABLE notices (outage TEXT, at INTEGER, customers INTEGER, text TEXT);
`;

export function reset(dir = stateDir()) {
  const p = paths(dir);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const db = new Database(p.oms, { create: true });
  db.exec("PRAGMA journal_mode = DELETE;");
  db.exec(SCHEMA);
  const net = seed.network();
  const tx = db.transaction(() => {
    const d = db.prepare("INSERT INTO devices (id, kind, feeder, parent) VALUES (?, ?, ?, ?)");
    for (const x of net.devices) d.run(x.id, x.kind, x.feeder, x.parent);
    const c = db.prepare("INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const x of seed.customers()) c.run(x.id, x.number, x.street, x.device, x.smart_meter ? 1 : 0, x.critical, x.name ?? null);
    const k = db.prepare("INSERT INTO crews (id, depot, skills) VALUES (?, ?, ?)");
    for (const x of seed.crews()) k.run(x.id, x.depot, x.skills.join(","));
    const rp = db.prepare("INSERT INTO reports VALUES (?, ?, ?, ?, ?)");
    for (const x of seed.reports()) rp.run(x.id, x.at, x.channel, x.customer_hint, x.text);
  });
  tx();
  db.close();
  writeFileSync(p.ledger, "");
  writeFileSync(p.events, "");
  return p;
}

export function open(dir = stateDir(), readonly = false) {
  const p = paths(dir);
  if (!existsSync(p.oms)) throw new Error(`No OMS at ${p.oms}. Run: bun run world reset`);
  return new Database(p.oms, readonly ? { readonly: true } : undefined);
}

export function tables(dir = stateDir()): string[] {
  const db = open(dir, true);
  const rows = db.query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[];
  db.close();
  return rows.map((r) => r.name);
}

export const readJsonl = <T = any>(file: string): T[] =>
  existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T) : [];
