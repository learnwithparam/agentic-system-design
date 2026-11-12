// Builds the seed files in world/seed/ from one random seed. Run only when the world itself changes:
//   bun world/build.ts
// The seed files are committed, so learners never run this.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { rng } from "./lib/rng";
import type { Crew, Customer, Device, Network, Report, TrueOutage, Truth } from "./lib/types";

const r = rng(20261214);
const SEED = join(import.meta.dir, "seed");

const PREFIX = ["Ash", "Birch", "Brook", "Castle", "Cedar", "Church", "Clover", "Elm", "Fern", "Field", "Glen", "Hazel", "Heath", "Holly", "Kiln", "Larch", "Linden", "Mill", "Moor", "Oak", "Orchard", "Pine", "Quarry", "Rowan", "Saxon", "Station", "Thorn", "Vale", "Willow", "Yew"];
const SUFFIX = ["Road", "Lane", "Close", "Street", "Way"];
const streets = r.shuffle(PREFIX.flatMap((p) => SUFFIX.map((s) => `${p} ${s}`)));
let streetIx = 0;
const nextStreet = () => streets[streetIx++];

// Network: two substations, twelve feeders, a recloser at the head of each feeder and fused branches below.
const devices: Device[] = [];
const feeders = Array.from({ length: 12 }, (_, i) => `F${String(i + 1).padStart(2, "0")}`);
for (const f of feeders) {
  devices.push({ id: `R-${f}`, kind: "recloser", feeder: f, parent: null, streets: [nextStreet()] });
  const fuses = r.int(5, 6);
  for (let k = 1; k <= fuses; k++) devices.push({ id: `FU-${f}-${k}`, kind: "fuse", feeder: f, parent: `R-${f}`, streets: [nextStreet()] });
}
const network: Network = {
  company: "Copperbeck Power",
  substations: [
    { id: "beckside", name: "Beckside", feeders: feeders.slice(0, 6) },
    { id: "fellgate", name: "Fellgate", feeders: feeders.slice(6) },
  ],
  devices,
};

// Customers: 9,000, spread over the devices. Each street holds the customers of one device.
const customers: Customer[] = [];
const TOTAL = 9000;
const weights = devices.map((d) => (d.kind === "recloser" ? r.int(60, 110) : r.int(80, 150)));
const sum = weights.reduce((a, b) => a + b, 0);
let given = 0;
devices.forEach((d, i) => {
  const n = i === devices.length - 1 ? TOTAL - given : Math.round((weights[i] / sum) * TOTAL);
  given += n;
  for (let k = 1; k <= n; k++) {
    customers.push({ id: `C${String(customers.length + 1).padStart(5, "0")}`, number: k, street: d.streets[0], device: d.id, smart_meter: r.chance(0.65), critical: null });
  }
});

// Critical customers the desk must call by a person.
const onDevice = (dev: string) => customers.filter((c) => c.device === dev);
const mark = (c: Customer, kind: string, name: string) => { c.critical = kind; c.name = name; c.smart_meter = true; };
mark(onDevice("R-F03")[0], "hospital", "St Aldric's Community Hospital");
mark(onDevice("FU-F05-2")[0], "care-home", "Ellerby House care home");
mark(onDevice("R-F09")[0], "water", "Thornwick water pumping station");
const oxygenDevices = ["FU-F01-3", "FU-F05-2", "FU-F07-1", "FU-F09-4", "FU-F11-2", "FU-F12-5"];
oxygenDevices.forEach((d, i) => mark(onDevice(d)[3 + i], "home-oxygen", `Home oxygen customer ${i + 1}`));

// Crews.
const crews: Crew[] = Array.from({ length: 9 }, (_, i) => ({ id: `CREW-${i + 1}`, depot: i < 5 ? "beckside" : "fellgate", skills: i % 3 === 0 ? ["line", "switching"] : ["line"] }));

// The storm: four reclosers and twenty-seven fuses fail. FU-F05-2 fails under R-F05 (the nested fault).
const outages: TrueOutage[] = [];
const failedReclosers = ["R-F03", "R-F05", "R-F09", "R-F11"];
for (const d of failedReclosers) outages.push({ id: "", device: d, starts_at: r.int(10, 160), repair_minutes: r.int(90, 200), travel_minutes: r.int(20, 50), nested_under: null });
const r05 = outages.find((o) => o.device === "R-F05")!;
outages.push({ id: "", device: "FU-F05-2", starts_at: r05.starts_at, repair_minutes: r.int(50, 90), travel_minutes: r.int(15, 35), nested_under: "R-F05" });
const freeFuses = devices.filter((d) => d.kind === "fuse" && !failedReclosers.includes(d.parent!));
for (const d of r.shuffle(freeFuses).slice(0, 26)) outages.push({ id: "", device: d.id, starts_at: r.int(0, 300), repair_minutes: r.int(40, 120), travel_minutes: r.int(15, 45), nested_under: null });
outages.sort((a, b) => a.starts_at - b.starts_at || a.device.localeCompare(b.device));
outages.forEach((o, i) => (o.id = `T${String(i + 1).padStart(2, "0")}`));

// Which customers go dark, and when.
const failedAt = new Map(outages.map((o) => [o.device, o.starts_at]));
const darkSince = (c: Customer): number | null => {
  const dev = devices.find((d) => d.id === c.device)!;
  const times = [failedAt.get(dev.id), dev.parent ? failedAt.get(dev.parent) : undefined].filter((x): x is number => x !== undefined);
  return times.length ? Math.min(...times) : null;
};

// Reports.
type Draft = Omit<Report, "id">;
const drafts: { d: Draft; customer: string; dark: boolean }[] = [];
const phone = [
  (c: Customer) => `Caller says the power went off at ${c.number} ${c.street}. Whole house is dark.`,
  (c: Customer) => `Customer at ${c.number} ${c.street} reports no electricity since the wind picked up. Asked when it will be back.`,
  (c: Customer) => `Elderly caller, ${c.number} ${c.street}, lights out and heating off. Neighbours also dark.`,
  (c: Customer) => `Caller reports a bang outside then everything off. Address given as ${c.street}, number ${c.number}.`,
];
const text = [
  (c: Customer) => `no power at ${c.number} ${c.street.toLowerCase()} pls help`,
  (c: Customer) => `${c.number} ${c.street} power out`,
  (c: Customer) => `Hi, power's gone at ${c.number} ${c.street}, whole street looks dark`,
  (c: Customer) => `pwr off ${c.street} no ${c.number}. when back??`,
];
const web = (c: Customer) => `Account ${c.id}. Address: ${c.number} ${c.street}. Problem: No power. Notes: lost power during the storm.`;
const notOut = [
  (c: Customer) => `Lights flickered at ${c.number} ${c.street} but power is on now. Just letting you know.`,
  (c: Customer) => `Only my kitchen sockets are off at ${c.number} ${c.street}, the rest of the house works.`,
  (c: Customer) => `${c.number} ${c.street} power back, false alarm sorry`,
];

for (const c of customers) {
  const since = darkSince(c);
  if (since === null) continue;
  if (c.smart_meter && r.chance(0.3)) drafts.push({ d: { at: since + r.int(0, 2), channel: "meter", customer_hint: c.id, text: "LAST_GASP" }, customer: c.id, dark: true });
  if (r.chance(c.critical ? 1 : 0.42)) {
    const times = r.chance(0.08) ? 2 : 1;
    for (let t = 0; t < times; t++) {
      const roll = r.next();
      const ch = roll < 0.45 ? "phone" : roll < 0.8 ? "text" : "web";
      const body = ch === "phone" ? r.pick(phone)(c) : ch === "text" ? r.pick(text)(c) : web(c);
      drafts.push({ d: { at: since + r.int(3, 90), channel: ch, customer_hint: ch === "web" ? c.id : null, text: body }, customer: c.id, dark: true });
    }
  }
}
// Reports from customers who still have power: flicker, own breaker, power already back.
const lit = customers.filter((c) => darkSince(c) === null);
const TARGET = 4200;
while (drafts.length < TARGET) {
  const c = r.pick(lit);
  const ch = r.chance(0.5) ? "phone" : "text";
  drafts.push({ d: { at: r.int(0, 330), channel: ch, customer_hint: null, text: r.pick(notOut)(c) }, customer: c.id, dark: false });
}
if (drafts.length > TARGET) throw new Error(`too many dark reports (${drafts.length}); lower the report rate`);
drafts.sort((a, b) => a.d.at - b.d.at || a.customer.localeCompare(b.customer));
const reports: Report[] = drafts.map((x, i) => ({ id: `RPT-${String(i + 1).padStart(4, "0")}`, ...x.d }));
const truth: Truth = {
  outages,
  report_truth: Object.fromEntries(drafts.map((x, i) => [reports[i].id, { customer: x.customer, dark: x.dark }])),
};

writeFileSync(join(SEED, "network.json"), JSON.stringify(network, null, 1) + "\n");
writeFileSync(join(SEED, "customers.json"), JSON.stringify(customers) + "\n");
writeFileSync(join(SEED, "crews.json"), JSON.stringify(crews, null, 1) + "\n");
writeFileSync(join(SEED, "reports.jsonl"), reports.map((x) => JSON.stringify(x)).join("\n") + "\n");
writeFileSync(join(SEED, "truth.json"), JSON.stringify(truth) + "\n");
const dark = drafts.filter((x) => x.dark).length;
console.log(`customers ${customers.length}, devices ${devices.length}, outages ${outages.length}, reports ${reports.length} (${dark} from dark homes, ${reports.length - dark} not)`);
