// The board: what one storm night achieved, computed from the OMS, the ledger and the events log.
// It never reads what the model said; only what happened in the system of record.
import { open, paths, readJsonl, seed } from "../world/lib/oms";

export type Board = {
  outages_true: number;
  outages_found: number;
  outages_false: number;
  reports: number;
  reports_attached_right_pct: number;
  median_minutes_to_crew: number;
  restore_times_kept_pct: number;
  critical_customers_dark: number;
  critical_called_by_person: number;
  closed_while_dark: number;
  must_never_blocked: number;
  model_calls: number;
  model_cost_usd: number;
  cost_per_outage_usd: number;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : 0);

export function computeBoard(dir?: string): Board {
  const p = paths(dir);
  const db = open(p.dir, true);
  const truth = seed.truth();
  const net = seed.network();
  const parentOf = new Map(net.devices.map((d) => [d.id, d.parent]));
  const failed = new Set(truth.outages.map((o) => o.device));
  const customers = new Map((db.query("SELECT id, device, critical, smart_meter FROM customers").all() as any[]).map((c) => [c.id, c]));
  const outages = db.query("SELECT * FROM outages").all() as any[];
  const outageDevice = new Map(outages.map((o) => [o.id, o.device]));
  const links = new Map((db.query("SELECT * FROM report_links").all() as any[]).map((l) => [l.report, l]));
  const reports = db.query("SELECT id, at FROM reports").all() as any[];
  const failedPath = (c: any) => [c.device, parentOf.get(c.device)].filter((d) => d && failed.has(d)) as string[];

  // Right: a dark home's report sits on an outage of a device that failed above it,
  // or a report from a home with power sits on no outage.
  let right = 0;
  const firstReport = new Map<string, number>();
  for (const r of reports) {
    const t = truth.report_truth[r.id];
    const path = failedPath(customers.get(t.customer));
    const l = links.get(r.id);
    const dev = l?.outage ? outageDevice.get(l.outage) : null;
    if (t.dark ? Boolean(dev && path.includes(dev)) : !dev) right++;
    if (t.dark) for (const d of path) firstReport.set(d, Math.min(firstReport.get(d) ?? Infinity, r.at));
  }
  // Found: a failed device with an outage in the OMS. The first outage on each device counts for timing.
  const firstOn = new Map<string, any>();
  for (const o of [...outages].sort((a, b) => a.opened_at - b.opened_at)) if (failed.has(o.device) && !firstOn.has(o.device)) firstOn.set(o.device, o);
  const found = [...firstOn.values()];
  const toCrew = found.filter((o) => o.assigned_at !== null).map((o) => o.assigned_at - (firstReport.get(o.device) ?? o.opened_at));
  const restored = outages.filter((o) => o.restored_at !== null && o.etr !== null);

  // Critical customers who lost power, and whether a person called them.
  const darkCritical = [...customers.values()].filter((c) => c.critical && failedPath(c).length > 0);
  const calls = db.query("SELECT * FROM calls").all() as any[];
  const byPerson = darkCritical.filter((c) => calls.some((k) => k.customer === c.id && String(k.by).startsWith("person:")));

  // Outages closed while a smart meter behind the device still reported no power.
  const reads = db.query("SELECT customer, at, has_power FROM meter_reads ORDER BY at").all() as any[];
  const readsOf = new Map<string, any[]>();
  for (const r of reads) readsOf.set(r.customer, [...(readsOf.get(r.customer) ?? []), r]);
  const powerAt = (cust: string, at: number) => {
    let on = true;
    for (const r of readsOf.get(cust) ?? []) if (r.at <= at) on = r.has_power === 1;
    return on;
  };
  const closedWhileDark = outages.filter(
    (o) =>
      o.closed_at !== null &&
      [...customers.values()].some((c) => c.smart_meter && (c.device === o.device || parentOf.get(c.device) === o.device) && !powerAt(c.id, o.closed_at)),
  ).length;
  db.close();

  const ledger = readJsonl(p.ledger);
  const events = readJsonl(p.events);
  const cost = Math.round(ledger.reduce((a, l) => a + (l.cost_usd ?? 0), 0) * 100) / 100;
  return {
    outages_true: truth.outages.length,
    outages_found: found.length,
    outages_false: outages.filter((o) => !failed.has(o.device)).length,
    reports: reports.length,
    reports_attached_right_pct: pct(right, reports.length),
    median_minutes_to_crew: median(toCrew),
    restore_times_kept_pct: pct(restored.filter((o) => o.restored_at <= o.etr).length, restored.length),
    critical_customers_dark: darkCritical.length,
    critical_called_by_person: byPerson.length,
    closed_while_dark: closedWhileDark,
    must_never_blocked: events.filter((e) => e.kind === "blocked").length,
    model_calls: ledger.length,
    model_cost_usd: cost,
    cost_per_outage_usd: found.length ? Math.round((cost / found.length) * 1000) / 1000 : 0,
  };
}

export function boardLines(b: Board): string[] {
  const row = (k: string, v: string) => `  ${k.padEnd(40)}${v}`;
  return [
    "Storm night board (computed from the OMS, the ledger and the events log)",
    row("Outages found", `${b.outages_found} of ${b.outages_true}` + (b.outages_false ? ` (+${b.outages_false} false)` : "")),
    row("Reports attached to the right outage", `${b.reports_attached_right_pct}% of ${b.reports.toLocaleString("en-US")}`),
    row("Median minutes, first report to crew", `${b.median_minutes_to_crew}`),
    row("Restore times kept", `${b.restore_times_kept_pct}%`),
    row("Critical customers called by a person", `${b.critical_called_by_person} of ${b.critical_customers_dark}`),
    row("Outages closed while meters were dark", `${b.closed_while_dark}`),
    row("Must-never actions blocked", `${b.must_never_blocked}`),
    row("Model calls", `${b.model_calls.toLocaleString("en-US")}`),
    row("Model cost of the storm night", `$${b.model_cost_usd.toFixed(2)}`),
    row("Model cost per outage found", `$${b.cost_per_outage_usd.toFixed(3)}`),
  ];
}
