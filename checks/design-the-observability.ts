import type { Rule } from "../scripts/verify";
import { asList, block, designData, isFilled, readDesign, wordCount } from "./lib/design";

// One signal in the Observability block. A learner may leave any field out.
type Signal = {
  failure?: unknown;
  signal?: unknown;
  source?: unknown;
  field?: unknown;
  alertAbove?: unknown;
  unit?: unknown;
  tells?: unknown;
  action?: unknown;
};

const FILE = "observability.md";

// Where a signal is written. Each one is a record a check can read.
export const SOURCES = ["ledger", "events", "oms", "run-state"];

// Words that name nobody. An alert that goes to "the team" goes to no one.
const NOBODY = /\b(team|everyone|someone|anyone|whoever|all)\b/i;

const signalsOf = (folder: string) =>
  asList<Signal>(designData<{ signals?: unknown }>(folder, "Observability", FILE)?.signals);

const failuresOf = (folder: string) =>
  asList<{ failure?: unknown }>(
    designData<{ failures?: unknown }>(folder, "Failures")?.failures,
  ).map((row) => String(row.failure));

function rowIsComplete(row: Signal): boolean {
  const named = isFilled(row.signal) && isFilled(row.field) && isFilled(row.unit);
  const number = typeof row.alertAbove === "number" && row.alertAbove > 0;
  return named && number && SOURCES.includes(String(row.source));
}

export default [
  {
    says: "observability.md has an Observability section with a yaml design block",
    test: (folder) => block(readDesign(folder, FILE), "Observability").ok,
    tryNext:
      "fill the yaml design block under ## Observability in observability.md; " +
      "keep the fence line ```yaml design",
  },
  {
    says: "one id ties every record of a run together",
    test: (folder) => {
      const data = designData<{ runIdField?: unknown }>(folder, "Observability", FILE);
      return isFilled(data?.runIdField);
    },
    tryNext:
      "add run_id_field: to the block, such as run_id, and write that field on every ledger, " +
      "events and run state record",
  },
  {
    says: "every failure in design.md has a signal",
    test: (folder) => {
      const covered = signalsOf(folder).map((row) => String(row.failure));
      const failures = failuresOf(folder);
      return failures.length > 0 && failures.every((name) => covered.includes(name));
    },
    tryNext:
      "add a signal for each row of the Failures section; copy its failure: text " +
      "word for word into failure:",
  },
  {
    says: "every signal has a source record, a field, and a number to alert above with its unit",
    test: (folder) => {
      const rows = signalsOf(folder);
      return rows.length > 0 && rows.every(rowIsComplete);
    },
    tryNext:
      `give each signal a source (${SOURCES.join(", ")}), a field, alert_above as a number ` +
      "and a unit such as minutes or dollars",
  },
  {
    says: "every alert names one person and what that person does",
    test: (folder) => {
      const rows = signalsOf(folder);
      const named = (row: Signal) => isFilled(row.tells) && !NOBODY.test(String(row.tells));
      return rows.length > 0 && rows.every((row) => named(row) && wordCount(row.action) >= 5);
    },
    tryNext:
      "set tells: to one role, such as desk-lead or duty-manager, never the team, " +
      "and write action: in at least 5 words",
  },
] satisfies Rule[];
