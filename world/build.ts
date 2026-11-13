// Builds the seed files in world/seed/ from one random seed.
// Run it only when the world itself changes:
//   bun world/build.ts
// The seed files are committed, so learners never run this.
// Every random draw happens in a fixed order. Moving one draw changes the whole world.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { withSnakeCaseNames } from "./lib/field-names";
import { seededRandom } from "./lib/random";
import type { Crew, Customer, Device, Network, Report, TrueOutage, Truth } from "./lib/types";

const random = seededRandom(20261214);
const SEED_FOLDER = join(import.meta.dir, "seed");

const STREET_NAMES = [
  ...["Ash", "Birch", "Brook", "Castle", "Cedar", "Church", "Clover", "Elm", "Fern", "Field"],
  ...["Glen", "Hazel", "Heath", "Holly", "Kiln", "Larch", "Linden", "Mill", "Moor", "Oak"],
  ...["Orchard", "Pine", "Quarry", "Rowan", "Saxon", "Station", "Thorn", "Vale", "Willow", "Yew"],
];
const STREET_TYPES = ["Road", "Lane", "Close", "Street", "Way"];
const TOTAL_CUSTOMERS = 9000;
const TOTAL_REPORTS = 4200;

// The network: two substations, twelve feeders, a recloser at the head of each feeder
// and fused branches below it. Each device feeds one street.
function buildNetwork(): Network {
  const allStreets = STREET_NAMES.flatMap((name) => STREET_TYPES.map((type) => `${name} ${type}`));
  const streets = random.shuffle(allStreets);
  let streetsUsed = 0;
  const nextStreet = () => streets[streetsUsed++];

  const devices: Device[] = [];
  const feeders = Array.from({ length: 12 }, (_, i) => `F${String(i + 1).padStart(2, "0")}`);
  for (const feeder of feeders) {
    const recloser = `R-${feeder}`;
    devices.push({ id: recloser, kind: "recloser", feeder, parent: null, streets: [nextStreet()] });
    const fuseCount = random.wholeNumber(5, 6);
    for (let fuse = 1; fuse <= fuseCount; fuse++) {
      const id = `FU-${feeder}-${fuse}`;
      devices.push({ id, kind: "fuse", feeder, parent: recloser, streets: [nextStreet()] });
    }
  }
  const substations = [
    { id: "beckside", name: "Beckside", feeders: feeders.slice(0, 6) },
    { id: "fellgate", name: "Fellgate", feeders: feeders.slice(6) },
  ];
  return { company: "Copperbeck Power", substations, devices };
}

// 9,000 customers spread over the devices. Each street holds the customers of one device.
function buildCustomers(devices: Device[]): Customer[] {
  const weights = devices.map((device) => {
    if (device.kind === "recloser") return random.wholeNumber(60, 110);
    return random.wholeNumber(80, 150);
  });
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  const customers: Customer[] = [];
  let placed = 0;
  devices.forEach((device, index) => {
    const isLastDevice = index === devices.length - 1;
    const share = Math.round((weights[index] / totalWeight) * TOTAL_CUSTOMERS);
    const count = isLastDevice ? TOTAL_CUSTOMERS - placed : share;
    placed += count;
    for (let houseNumber = 1; houseNumber <= count; houseNumber++) {
      const id = `C${String(customers.length + 1).padStart(5, "0")}`;
      const street = device.streets[0];
      const smartMeter = random.chance(0.65);
      customers.push({
        id,
        number: houseNumber,
        street,
        device: device.id,
        smartMeter,
        critical: null,
      });
    }
  });
  return customers;
}

// Critical customers the desk must call by a person. Each one always has a smart meter.
function markCriticalCustomers(customers: Customer[]) {
  const customersOn = (device: string) =>
    customers.filter((customer) => customer.device === device);
  const mark = (customer: Customer, kind: string, name: string) => {
    customer.critical = kind;
    customer.name = name;
    customer.smartMeter = true;
  };
  mark(customersOn("R-F03")[0], "hospital", "St Aldric's Community Hospital");
  mark(customersOn("FU-F05-2")[0], "care-home", "Ellerby House care home");
  mark(customersOn("R-F09")[0], "water", "Thornwick water pumping station");
  const oxygenDevices = ["FU-F01-3", "FU-F05-2", "FU-F07-1", "FU-F09-4", "FU-F11-2", "FU-F12-5"];
  oxygenDevices.forEach((device, index) => {
    const customer = customersOn(device)[3 + index];
    mark(customer, "home-oxygen", `Home oxygen customer ${index + 1}`);
  });
}

function buildCrews(): Crew[] {
  return Array.from({ length: 9 }, (_, index) => ({
    id: `CREW-${index + 1}`,
    depot: index < 5 ? "beckside" : "fellgate",
    skills: index % 3 === 0 ? ["line", "switching"] : ["line"],
  }));
}

type Minutes = { lowest: number; highest: number };

// One failed device. The random draws happen in this order: start, repair, travel.
function failure(device: string, startsAt: number, repair: Minutes, travel: Minutes): TrueOutage {
  return {
    id: "",
    device,
    startsAt,
    repairMinutes: random.wholeNumber(repair.lowest, repair.highest),
    travelMinutes: random.wholeNumber(travel.lowest, travel.highest),
    nestedUnder: null,
  };
}

// The storm: four reclosers and twenty-seven fuses fail.
// FU-F05-2 fails under R-F05, which is the nested fault a careful design must catch.
function buildStorm(devices: Device[]): TrueOutage[] {
  const outages: TrueOutage[] = [];
  const failedReclosers = ["R-F03", "R-F05", "R-F09", "R-F11"];
  for (const device of failedReclosers) {
    const startsAt = random.wholeNumber(10, 160);
    outages.push(
      failure(device, startsAt, { lowest: 90, highest: 200 }, { lowest: 20, highest: 50 }),
    );
  }
  const recloserF05 = outages.find((outage) => outage.device === "R-F05") as TrueOutage;
  const nested = failure(
    "FU-F05-2",
    recloserF05.startsAt,
    { lowest: 50, highest: 90 },
    {
      lowest: 15,
      highest: 35,
    },
  );
  outages.push({ ...nested, nestedUnder: "R-F05" });

  const fusesUnderWorkingReclosers = devices.filter(
    (device) => device.kind === "fuse" && !failedReclosers.includes(device.parent as string),
  );
  const failedFuses = random.shuffle(fusesUnderWorkingReclosers).slice(0, 26);
  for (const fuse of failedFuses) {
    const startsAt = random.wholeNumber(0, 300);
    outages.push(
      failure(fuse.id, startsAt, { lowest: 40, highest: 120 }, { lowest: 15, highest: 45 }),
    );
  }
  outages.sort((first, second) => {
    return first.startsAt - second.startsAt || first.device.localeCompare(second.device);
  });
  outages.forEach((outage, index) => {
    outage.id = `T${String(index + 1).padStart(2, "0")}`;
  });
  return outages;
}

// The minute a customer loses power, or null when the storm never reaches them.
function darkSinceFinder(devices: Device[], outages: TrueOutage[]) {
  const failedAt = new Map(outages.map((outage) => [outage.device, outage.startsAt]));
  return (customer: Customer): number | null => {
    const device = devices.find((candidate) => candidate.id === customer.device) as Device;
    const ownFailure = failedAt.get(device.id);
    const parentFailure = device.parent ? failedAt.get(device.parent) : undefined;
    const times = [ownFailure, parentFailure].filter((time) => time !== undefined);
    return times.length ? Math.min(...times) : null;
  };
}

type Draft = { report: Omit<Report, "id">; customer: string; dark: boolean };

const PHONE_NOTES = [
  (customer: Customer) =>
    `Caller says the power went off at ${customer.number} ${customer.street}. Whole house is dark.`,
  (customer: Customer) =>
    `Customer at ${customer.number} ${customer.street} reports no electricity since the wind ` +
    "picked up. Asked when it will be back.",
  (customer: Customer) =>
    `Elderly caller, ${customer.number} ${customer.street}, lights out and heating off. ` +
    "Neighbours also dark.",
  (customer: Customer) =>
    "Caller reports a bang outside then everything off. " +
    `Address given as ${customer.street}, number ${customer.number}.`,
];
const TEXT_MESSAGES = [
  (customer: Customer) =>
    `no power at ${customer.number} ${customer.street.toLowerCase()} pls help`,
  (customer: Customer) => `${customer.number} ${customer.street} power out`,
  (customer: Customer) =>
    `Hi, power's gone at ${customer.number} ${customer.street}, whole street looks dark`,
  (customer: Customer) => `pwr off ${customer.street} no ${customer.number}. when back??`,
];
const webForm = (customer: Customer) =>
  `Account ${customer.id}. Address: ${customer.number} ${customer.street}. ` +
  "Problem: No power. Notes: lost power during the storm.";
const NOT_AN_OUTAGE = [
  (customer: Customer) =>
    `Lights flickered at ${customer.number} ${customer.street} but power is on now. ` +
    "Just letting you know.",
  (customer: Customer) =>
    `Only my kitchen sockets are off at ${customer.number} ${customer.street}, ` +
    "the rest of the house works.",
  (customer: Customer) => `${customer.number} ${customer.street} power back, false alarm sorry`,
];

// A phone, text or web report from a dark home.
// The draws happen in this order: channel, words, time.
function darkHomeReport(customer: Customer, darkSince: number): Draft {
  const roll = random.next();
  let channel: Report["channel"] = "web";
  if (roll < 0.45) channel = "phone";
  else if (roll < 0.8) channel = "text";
  let text = webForm(customer);
  if (channel === "phone") text = random.pick(PHONE_NOTES)(customer);
  if (channel === "text") text = random.pick(TEXT_MESSAGES)(customer);
  const reportedAt = darkSince + random.wholeNumber(3, 90);
  const customerHint = channel === "web" ? customer.id : null;
  const report = { at: reportedAt, channel, customerHint, text };
  return { report, customer: customer.id, dark: true };
}

// About 3 in 10 smart meters send an alarm within 2 minutes of losing power.
// LAST_GASP is the text of that alarm.
function meterAlarm(customer: Customer, darkSince: number): Draft | null {
  if (!(customer.smartMeter && random.chance(0.3))) return null;
  const alarmAt = darkSince + random.wholeNumber(0, 2);
  const channel = "meter" as const;
  const alarm = { at: alarmAt, channel, customerHint: customer.id, text: "LAST_GASP" };
  return { report: alarm, customer: customer.id, dark: true };
}

// Every critical customer reports. Others report 42 times in 100, and some report twice.
function phoneTextOrWebReports(customer: Customer, darkSince: number): Draft[] {
  const reportsAtAll = random.chance(customer.critical ? 1 : 0.42);
  if (!reportsAtAll) return [];
  const reportCount = random.chance(0.08) ? 2 : 1;
  const drafts: Draft[] = [];
  for (let i = 0; i < reportCount; i++) drafts.push(darkHomeReport(customer, darkSince));
  return drafts;
}

// Reports from homes that lost power: smart meter alarms, and calls, texts and web forms.
function reportsFromDarkHomes(
  customers: Customer[],
  darkSinceOf: (customer: Customer) => number | null,
): Draft[] {
  const drafts: Draft[] = [];
  for (const customer of customers) {
    const darkSince = darkSinceOf(customer);
    if (darkSince === null) continue;
    const alarm = meterAlarm(customer, darkSince);
    if (alarm) drafts.push(alarm);
    drafts.push(...phoneTextOrWebReports(customer, darkSince));
  }
  return drafts;
}

// Reports from customers who still have power: a flicker, their own breaker, power already back.
function reportsFromLitHomes(litCustomers: Customer[], drafts: Draft[]) {
  while (drafts.length < TOTAL_REPORTS) {
    const customer = random.pick(litCustomers);
    const channel = random.chance(0.5) ? "phone" : "text";
    const reportedAt = random.wholeNumber(0, 330);
    const text = random.pick(NOT_AN_OUTAGE)(customer);
    const report = { at: reportedAt, channel, customerHint: null, text } as const;
    drafts.push({ report, customer: customer.id, dark: false });
  }
}

function writeSeedFile(fileName: string, text: string) {
  writeFileSync(join(SEED_FOLDER, fileName), text);
}

const asJson = (value: unknown, indent?: number) =>
  `${JSON.stringify(withSnakeCaseNames(value), null, indent)}\n`;

const network = buildNetwork();
const customers = buildCustomers(network.devices);
markCriticalCustomers(customers);
const crews = buildCrews();
const outages = buildStorm(network.devices);
const darkSinceOf = darkSinceFinder(network.devices, outages);

const drafts = reportsFromDarkHomes(customers, darkSinceOf);
if (drafts.length > TOTAL_REPORTS) {
  throw new Error(`too many dark reports (${drafts.length}); lower the report rate`);
}
const litCustomers = customers.filter((customer) => darkSinceOf(customer) === null);
reportsFromLitHomes(litCustomers, drafts);
drafts.sort((first, second) => {
  return first.report.at - second.report.at || first.customer.localeCompare(second.customer);
});

const reports: Report[] = drafts.map((draft, index) => {
  const id = `RPT-${String(index + 1).padStart(4, "0")}`;
  return { id, ...draft.report };
});
const reportTruth = Object.fromEntries(
  drafts.map((draft, index) => [reports[index].id, { customer: draft.customer, dark: draft.dark }]),
);
const truth: Truth = { outages, reportTruth };

writeSeedFile("network.json", asJson(network, 1));
writeSeedFile("customers.json", asJson(customers));
writeSeedFile("crews.json", asJson(crews, 1));
const reportLines = reports.map((report) => JSON.stringify(withSnakeCaseNames(report)));
writeSeedFile("reports.jsonl", `${reportLines.join("\n")}\n`);
writeSeedFile("truth.json", asJson(truth));

const darkCount = drafts.filter((draft) => draft.dark).length;
const litCount = reports.length - darkCount;
console.log(
  `customers ${customers.length}, devices ${network.devices.length}, outages ${outages.length}, ` +
    `reports ${reports.length} (${darkCount} from dark homes, ${litCount} not)`,
);
