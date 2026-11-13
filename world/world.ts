// bun run world          seed the OMS if it is missing, then describe the world
// bun run world reset    wipe world/state/ and seed it again from world/seed/
import { existsSync } from "node:fs";
import { relative } from "node:path";
import { open, paths, reset, seed } from "./lib/oms";

const command = process.argv[2];
if (command && command !== "reset") {
  console.log(`Unknown command "${command}". Use: bun run world, or bun run world reset`);
  process.exit(1);
}

const statePaths = paths();
if (command === "reset" || !existsSync(statePaths.oms)) {
  reset();
  const shownPath = relative(process.cwd(), statePaths.oms) || statePaths.oms;
  console.log(`World reset: ${shownPath} seeded from world/seed/.`);
}

const db = open(undefined, true);
const countOf = (sql: string) => (db.query(sql).get() as { total: number }).total;
const withCommas = (count: number) => count.toLocaleString("en-US");

const { substations } = seed.network();
const feederCount = substations.reduce((total, substation) => total + substation.feeders.length, 0);
const substationNames = substations.map((substation) => substation.name).join(", ");
const customers = countOf("SELECT COUNT(*) total FROM customers");
const devices = countOf("SELECT COUNT(*) total FROM devices");
const criticalCustomers = countOf(
  "SELECT COUNT(*) total FROM customers WHERE critical IS NOT NULL",
);
const crews = countOf("SELECT COUNT(*) total FROM crews");
const reports = countOf("SELECT COUNT(*) total FROM reports");
const outages = countOf("SELECT COUNT(*) total FROM outages");

console.log("Copperbeck Power storm desk");
console.log(`  Customers:          ${withCommas(customers)}`);
console.log(
  `  Feeders:            ${feederCount} from ${substations.length} substations ` +
    `(${substationNames})`,
);
console.log(`  Devices:            ${devices} (reclosers and fuses)`);
console.log(`  Critical customers: ${criticalCustomers}`);
console.log(`  Crews:              ${crews}`);
console.log(
  `  Storm reports:      ${withCommas(reports)} (phone, text, web form, smart meter alarm)`,
);
console.log(`  Outages in the OMS: ${outages}`);
console.log("The world is ready. Next: bun run storm");
db.close();
