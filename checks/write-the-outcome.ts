import type { Rule } from "../scripts/verify";
import { asList, block, designData, isFilled, readDesign, wordCount } from "./lib/design";
import { readDesk, recordTables } from "./lib/world";

// The Outcome block. A learner may leave any field out, so every field is optional.
type Outcome = {
  outcome?: unknown;
  metric?: { name?: unknown; target?: unknown; unit?: unknown };
  mustNever?: unknown;
  systemOfRecord?: { name?: unknown; records?: unknown };
  doneWhen?: unknown;
};

type DoneCheck = { check?: unknown; reads?: unknown } | null;

const outcomeOf = (folder: string) => designData<Outcome>(folder, "Outcome") ?? {};
const mustNevers = (folder: string) => asList<unknown>(outcomeOf(folder).mustNever).map(String);

// True when the text matches every keyword.
// A keyword is a pattern, so "switch|feeder" means either word.
const coversEveryKeyword = (text: string, keywords: string[]) =>
  keywords.every((keyword) => new RegExp(keyword, "i").test(text));

// Words that mean "someone says it is done", which is not proof that it is done.
const SELF_REPORT = new RegExp(
  "\\b(agent|model|crew|system|bot)\\s+" +
    "(says|said|reports|reported|confirms|confirmed|marks|marked|thinks)\\b" +
    "|\\bsays (it is|it's) (done|fixed)",
  "i",
);

function metricIsComplete(folder: string): boolean {
  const metric = outcomeOf(folder).metric ?? {};
  const hasNumber = typeof metric.target === "number" && Number.isFinite(metric.target);
  return isFilled(metric.name) && hasNumber && isFilled(metric.unit);
}

// A done check reads real OMS tables and never takes anyone's word for it.
function isRecordCheck(doneCheck: DoneCheck, tables: string[]): boolean {
  const reads = asList<unknown>(doneCheck?.reads);
  const longEnough = wordCount(doneCheck?.check) >= 6;
  const notSelfReport = !SELF_REPORT.test(String(doneCheck?.check));
  const readsRealTables =
    reads.length > 0 && reads.every((table) => tables.includes(String(table)));
  return longEnough && notSelfReport && readsRealTables;
}

export default [
  {
    says: "design.md has an Outcome section with a yaml design block",
    test: (folder) => block(readDesign(folder), "Outcome").ok,
    tryNext:
      "fill the yaml design block under ## Outcome in design.md; " +
      "keep the fence line ```yaml design",
  },
  {
    says: "the outcome is a sentence of at least 8 words",
    test: (folder) => {
      const { outcome } = outcomeOf(folder);
      return isFilled(outcome) && wordCount(outcome) >= 8;
    },
    tryNext:
      "write outcome: as what a person at Copperbeck can see when the system works, " +
      "in one sentence",
  },
  {
    says: "the metric has a name, a number and a unit",
    test: metricIsComplete,
    tryNext:
      "set metric: name:, target: (a plain number such as 45) " +
      "and unit: (such as minutes or percent)",
  },
  {
    says: "every must-never is a sentence with the word never",
    test: (folder) => {
      const lines = mustNevers(folder);
      return (
        lines.length > 0 && lines.every((line) => /\bnever\b/i.test(line) && wordCount(line) >= 6)
      );
    },
    tryNext: "write each must_never: line as The system never ..., naming one action",
  },
  {
    says: "the must-never covers at least one hard rule in the desk policy",
    test: async (folder) => {
      const { hardRules } = await readDesk();
      const lines = mustNevers(folder);
      return hardRules.some((rule) =>
        lines.some((line) => coversEveryKeyword(line, rule.keywords)),
      );
    },
    tryNext:
      "read world/policy.md: P2 (closing an outage) and P3 (critical customers) " +
      "are the rules a machine could break",
  },
  {
    says: "the system of record is the OMS, and every record it names is a table in the OMS",
    test: async (folder) => {
      const systemOfRecord = outcomeOf(folder).systemOfRecord ?? {};
      const records = asList<unknown>(systemOfRecord.records).map(String);
      const tables = recordTables();
      const isTheOms = systemOfRecord.name === (await readDesk()).systemOfRecord;
      return isTheOms && records.length > 0 && records.every((record) => tables.includes(record));
    },
    tryNext:
      "set system_of_record: name: oms and records: to tables in world/state/oms.db " +
      `(${["outages", "meter_reads", "calls"].join(", ")} and others in world/README.md)`,
  },
  {
    says: "done is a check against OMS records, not anyone's word that it is done",
    test: (folder) => {
      const doneChecks = asList<DoneCheck>(outcomeOf(folder).doneWhen);
      const tables = recordTables();
      return doneChecks.length > 0 && doneChecks.every((check) => isRecordCheck(check, tables));
    },
    tryNext:
      "write done_when: as a check: a person could run against the OMS tables it reads:, " +
      "never the agent or crew saying it is done",
  },
] satisfies Rule[];
