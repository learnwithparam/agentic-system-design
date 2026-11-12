// bun run world          seed the OMS if it is missing, then describe the world
// bun run world reset    wipe world/state/ and seed it again from world/seed/
import { existsSync } from "node:fs";
import { relative } from "node:path";
import { open, paths, reset, seed } from "./lib/oms";

const cmd = process.argv[2];
if (cmd && cmd !== "reset") {
  console.log(`Unknown command "${cmd}". Use: bun run world, or bun run world reset`);
  process.exit(1);
}
const p = paths();
if (cmd === "reset" || !existsSync(p.oms)) {
  reset();
  console.log(`World reset: ${relative(process.cwd(), p.oms) || p.oms} seeded from world/seed/.`);
}
const db = open(undefined, true);
const n = (sql: string) => (db.query(sql).get() as { n: number }).n;
const net = seed.network();
console.log(`Copperbeck Power storm desk`);
console.log(`  Customers:          ${n("SELECT COUNT(*) n FROM customers").toLocaleString("en-US")}`);
console.log(`  Feeders:            ${net.substations.reduce((a, s) => a + s.feeders.length, 0)} from ${net.substations.length} substations (${net.substations.map((s) => s.name).join(", ")})`);
console.log(`  Devices:            ${n("SELECT COUNT(*) n FROM devices")} (reclosers and fuses)`);
console.log(`  Critical customers: ${n("SELECT COUNT(*) n FROM customers WHERE critical IS NOT NULL")}`);
console.log(`  Crews:              ${n("SELECT COUNT(*) n FROM crews")}`);
console.log(`  Storm reports:      ${n("SELECT COUNT(*) n FROM reports").toLocaleString("en-US")} (phone, text, web form, smart meter alarm)`);
console.log(`  Outages in the OMS: ${n("SELECT COUNT(*) n FROM outages")}`);
console.log(`The world is ready. Next: bun run storm`);
db.close();
