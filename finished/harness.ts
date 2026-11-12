// The finished system: the sample design for the Copperbeck storm desk, played through one storm night.
//   group-the-reports           workflow: code routes each report, a fast model call reads messy text
//   write-the-customer-updates  one model call per outage
//   plan-the-crews              an agent (smart role) that picks a crew and a restore time, one tool call per turn
//   switch-the-feeder           a person: the switching engineer
// Guards in code: P2 (never close while meters behind the device are dark) and P3 (critical customers get a person).
import { appendFileSync } from "node:fs";
import type { Database } from "bun:sqlite";
import { ask } from "../config/llm";
import { open, paths, reset, seed } from "../world/lib/oms";
import { unit } from "../world/lib/rng";
import { CREW, EXTRACT, UPDATE } from "./prompts";

const TICK = 5;
const LAST = 1200;

type Outage = { id: string; device: string; opened_at: number; status: string; crew: string | null; assigned_at: number | null; etr: number | null; restored_at: number | null; closed_at: number | null };

export async function runStorm(dir: string, opts: { log?: (s: string) => void } = {}) {
  const p = reset(dir);
  const db = open(dir);
  const log = opts.log ?? (() => {});
  const run = `run-${Date.now().toString(36)}`;
  const event = (e: Record<string, unknown>) => appendFileSync(p.events, JSON.stringify({ run, ...e }) + "\n");
  const ctx = (purpose: string) => ({ ledger: p.ledger, run, purpose });

  const net = seed.network();
  const parentOf = new Map(net.devices.map((d) => [d.id, d.parent]));
  const feederOf = new Map(net.devices.map((d) => [d.id, d.feeder]));
  const truth = seed.truth();
  const failAt = new Map(truth.outages.map((o) => [o.device, o]));
  const customers = db.query("SELECT id, number, street, device, smart_meter, critical, name FROM customers").all() as any[];
  const byId = new Map(customers.map((c) => [c.id, c]));
  const byAddr = new Map(customers.map((c) => [`${c.number}|${c.street.toLowerCase()}`, c]));
  const behind = (device: string) => customers.filter((c) => c.device === device || parentOf.get(c.device) === device);
  const reports = db.query("SELECT * FROM reports ORDER BY at, id").all() as any[];
  const repaired = new Set<string>();

  // The physical world: devices fail, crews finish, smart meters report.
  const pathFailed = (c: any) => [c.device, parentOf.get(c.device)].some((d) => d && failAt.has(d) && !repaired.has(d) && failAt.get(d)!.starts_at <= now);
  const meterRead = db.prepare("INSERT INTO meter_reads VALUES (?, ?, ?)");
  const powerState = new Map<string, boolean>();
  const refreshMeters = () => {
    for (const c of customers) {
      if (!c.smart_meter) continue;
      const on = !pathFailed(c);
      if (powerState.get(c.id) !== on) {
        powerState.set(c.id, on);
        if (now > 0 || !on) meterRead.run(c.id, now, on ? 1 : 0);
      }
    }
  };

  const outages = () => db.query("SELECT * FROM outages ORDER BY id").all() as Outage[];
  const openOutageOn = (device: string) => db.query("SELECT * FROM outages WHERE device = ? AND closed_at IS NULL").get(device) as Outage | null;
  let outageN = 0;
  const openOutage = (device: string, why: string) => {
    const id = `OUT-${String(++outageN).padStart(3, "0")}`;
    db.run("INSERT INTO outages (id, device, opened_at, status) VALUES (?, ?, ?, 'waiting')", [id, device, now]);
    event({ at: now, kind: "workflow", tool: "oms_open_outage", by: "workflow", args: { outage: id, device }, result: why });
    log(`  ${clock(now)}  opened ${id} on ${device} (${why})`);
    return id;
  };
  const link = db.prepare("INSERT OR REPLACE INTO report_links VALUES (?, ?, ?, ?)");

  // group-the-reports: a workflow. Code decides every step; the model only reads messy text.
  const pending: { report: string; customer: any }[] = [];
  const readReport = async (r: any) => {
    if (r.channel === "meter") return { customer: byId.get(r.customer_hint), kind: "outage" };
    const reply = await ask({ role: "fast", system: EXTRACT, prompt: `Report ${r.id} via ${r.channel}: ${r.text}` }, ctx("group-the-reports"));
    let x: any = {};
    try { x = JSON.parse(reply.text.slice(reply.text.indexOf("{"), reply.text.lastIndexOf("}") + 1)); } catch { x = {}; }
    const c = (x.account && byId.get(x.account)) || (x.number && x.street ? byAddr.get(`${x.number}|${String(x.street).toLowerCase()}`) : undefined);
    return { customer: c, kind: x.kind === "not-outage" ? "not-outage" : "outage" };
  };
  const groupReports = async (fresh: any[]) => {
    const read = await Promise.all(fresh.map(readReport));
    fresh.forEach((r, i) => {
      const { customer, kind } = read[i];
      if (!customer) return void link.run(r.id, null, null, "workflow:unmatched");
      if (kind === "not-outage") return void link.run(r.id, null, customer.id, "workflow:not-outage");
      pending.push({ report: r.id, customer });
    });
    // Attach to an open outage on the customer's own device or the recloser above it.
    for (let i = pending.length - 1; i >= 0; i--) {
      const { report, customer } = pending[i];
      const o = openOutageOn(customer.device) ?? (parentOf.get(customer.device) ? openOutageOn(parentOf.get(customer.device)!) : null);
      if (o && !o.restored_at) { link.run(report, o.id, customer.id, "workflow"); pending.splice(i, 1); }
    }
    // Open new outages: a whole feeder when its trunk or three branches report, else a branch with two homes.
    const byFeeder = new Map<string, typeof pending>();
    for (const x of pending) {
      const f = feederOf.get(x.customer.device)!;
      byFeeder.set(f, [...(byFeeder.get(f) ?? []), x]);
    }
    for (const [f, xs] of byFeeder) {
      const homes = (dev: string) => new Set(xs.filter((x) => x.customer.device === dev).map((x) => x.customer.id)).size;
      const devs = [...new Set(xs.map((x) => x.customer.device))];
      const trunk = homes(`R-${f}`);
      const branches = devs.filter((d) => d.startsWith("FU-") && homes(d) >= 1).length;
      const recloserOpen = openOutageOn(`R-${f}`);
      if (!recloserOpen && (trunk >= 2 || branches >= 3)) {
        const id = openOutage(`R-${f}`, trunk >= 2 ? `${trunk} homes on the feeder trunk report` : `${branches} branches report`);
        for (const x of xs) link.run(x.report, id, x.customer.id, "workflow");
        for (const x of xs) pending.splice(pending.indexOf(x), 1);
        continue;
      }
      for (const d of devs) {
        if (!d.startsWith("FU-") || homes(d) < 2 || openOutageOn(d)) continue;
        const id = openOutage(d, `${homes(d)} homes on the branch report`);
        for (const x of xs.filter((y) => y.customer.device === d)) { link.run(x.report, id, x.customer.id, "workflow"); pending.splice(pending.indexOf(x), 1); }
      }
    }
  };

  // plan-the-crews: an agent. The model picks the next step; code runs the tool and enforces the rules.
  const crewTurn = async (situation: Record<string, unknown>) => {
    const reply = await ask({ role: "smart", system: CREW, prompt: JSON.stringify(situation) }, ctx("plan-the-crews"));
    try { return JSON.parse(reply.text.slice(reply.text.indexOf("{"), reply.text.lastIndexOf("}") + 1)); } catch { return { tool: "none" }; }
  };
  const assigned = new Set<string>(); // idempotency keys for crew_assign
  const crewDoneAt = new Map<string, number>();
  const darkMetersBehind = (device: string) => behind(device).filter((c) => c.smart_meter && powerState.get(c.id) === false);

  const notify = async (o: Outage, includeCritical: boolean) => {
    const affected = behind(o.device);
    const critical = affected.filter((c) => c.critical);
    const minutes = (o.etr ?? now) - now;
    const msg = await ask({ role: "fast", system: UPDATE, prompt: `Outage ${o.id}: ${affected.length - critical.length} customers on ${[...new Set(affected.map((c) => c.street))].join(", ")}. Restore time: in about ${minutes} minutes.` }, ctx("write-the-customer-updates"));
    db.run("INSERT INTO notices VALUES (?, ?, ?, ?)", [o.id, now, affected.length - critical.length, msg.text]);
    event({ at: now, kind: "tool", tool: "notify_customers", by: "agent", args: { outage: o.id, include_critical: includeCritical }, result: `${affected.length - critical.length} texts` });
    for (const c of critical) {
      // P3: a critical customer hears the restore time from a person. The gate routes it to the desk lead.
      const answerIn = 6 + Math.floor(unit(`${o.id}${c.id}`) * 7);
      event({ at: now, kind: "gate", tool: "call_critical_customer", by: "agent", args: { outage: o.id, customer: c.id }, result: `routed to desk lead, answered in ${answerIn} min` });
      db.run("INSERT INTO calls VALUES (?, ?, ?, ?, ?)", [o.id, c.id, now + answerIn, "person:desk-lead", o.etr]);
      log(`  ${clock(now)}  ${c.name} routed to the desk lead, who calls at ${clock(now + answerIn).trim()}`);
    }
  };

  const tryClose = async (o: Outage) => {
    const t = await crewTurn({ ask: "crew_done", now, outage: o.id, device: o.device, crew: o.crew, crew_says: "repair done, power restored" });
    if (t.tool === "oms_read_meters") event({ at: now, kind: "tool", tool: "oms_read_meters", by: "agent", args: { outage: o.id }, result: `${darkMetersBehind(o.device).length} dark` });
    if (t.tool !== "oms_close_outage" && t.tool !== "oms_read_meters") return;
    const dark = darkMetersBehind(o.device);
    if (dark.length) {
      // P2: never close an outage while meters behind its device are dark.
      event({ at: now, kind: "blocked", rule: "P2", tool: "oms_close_outage", by: "agent", args: { outage: o.id }, result: `${dark.length} smart meters behind ${o.device} still dark` });
      log(`  ${clock(now)}  BLOCKED close of ${o.id}: ${dark.length} meters behind ${o.device} still dark`);
      for (const d of [...new Set(dark.map((c) => c.device))]) if (!openOutageOn(d)) openOutage(d, "meters still dark after the repair above it");
      return;
    }
    db.run("UPDATE outages SET status = 'closed', closed_at = ? WHERE id = ?", [now, o.id]);
    event({ at: now, kind: "tool", tool: "oms_close_outage", by: "agent", args: { outage: o.id }, result: "closed" });
  };

  let now = 0;
  log(`Storm night at Copperbeck Power: ${reports.length.toLocaleString("en-US")} reports arrive.`);
  for (now = 0; now <= LAST; now += TICK) {
    // Faults and repairs.
    for (const [o, at] of crewDoneAt) if (at <= now) {
      const row = db.query("SELECT * FROM outages WHERE id = ?").get(o) as Outage;
      crewDoneAt.delete(o);
      repaired.add(row.device);
      db.run("UPDATE devices SET energized = 1 WHERE id = ?", [row.device]);
      db.run("UPDATE outages SET status = 'restored', restored_at = ? WHERE id = ?", [now, o]);
      event({ at: now, kind: "person", tool: "switch_the_feeder", by: "person:switching-engineer", args: { device: row.device }, result: "energized" });
    }
    for (const t of truth.outages) if (t.starts_at === now || (t.starts_at < now && t.starts_at > now - TICK)) db.run("UPDATE devices SET energized = 0 WHERE id = ?", [t.device]);
    refreshMeters();

    // Restored outages: ask the agent whether to close (again after a block, once the meters change).
    for (const o of outages().filter((x) => x.status === "restored" && !x.closed_at)) {
      if (o.restored_at === now || darkMetersBehind(o.device).length === 0) await tryClose(o);
    }

    // New reports.
    const fresh = reports.filter((r) => r.at > now - TICK && r.at <= now);
    if (fresh.length) await groupReports(fresh);

    // Free crews to waiting outages.
    while (true) {
      const crews = db.query("SELECT id, depot FROM crews WHERE free_at <= ? ORDER BY id").all(now) as any[];
      const waiting = outages().filter((o) => o.status === "waiting");
      if (!crews.length || !waiting.length) break;
      const t = await crewTurn({
        ask: "assign", now,
        free_crews: crews.map((c) => c.id),
        waiting: waiting.map((o) => ({ outage: o.id, device: o.device, kind: o.device.startsWith("R-") ? "recloser" : "fuse", customers: behind(o.device).length, critical: behind(o.device).filter((c) => c.critical).map((c) => c.critical), opened_at: o.opened_at })),
      });
      const o = waiting.find((w) => w.id === t.outage);
      if (t.tool !== "crew_assign" || !o || !crews.some((c) => c.id === t.crew)) { event({ at: now, kind: "error", tool: t.tool, by: "agent", result: "bad tool call, retry next tick" }); break; }
      const key = `${o.id}:${t.crew}`;
      if (assigned.has(key)) break;
      assigned.add(key);
      const physical = failAt.get(o.device);
      const work = physical ? physical.travel_minutes + physical.repair_minutes : 30;
      const etr = now + Number(t.etr_minutes);
      db.run("UPDATE outages SET status = 'assigned', crew = ?, assigned_at = ?, etr = ? WHERE id = ?", [t.crew, now, etr, o.id]);
      db.run("UPDATE crews SET free_at = ? WHERE id = ?", [now + work, t.crew]);
      crewDoneAt.set(o.id, now + work);
      event({ at: now, kind: "tool", tool: "crew_assign", by: "agent", args: { outage: o.id, crew: t.crew, etr_minutes: t.etr_minutes, idempotency_key: key }, result: "assigned" });
      log(`  ${clock(now)}  ${t.crew} to ${o.id} on ${o.device}, restore in about ${t.etr_minutes} min`);
      const n = await crewTurn({ ask: "notify", now, outage: o.id, etr_minutes: t.etr_minutes, critical: behind(o.device).filter((c) => c.critical).length });
      if (n.tool === "notify_customers") await notify({ ...o, etr, crew: t.crew }, Boolean(n.include_critical));
    }

    const done = truth.outages.every((t) => repaired.has(t.device)) && outages().every((o) => o.closed_at !== null);
    if (now > 360 && done) break;
  }
  db.close();
  return { run, dir: p.dir, endedAt: now };
}

export const clock = (m: number) => `+${String(m).padStart(3, " ")} min`;
