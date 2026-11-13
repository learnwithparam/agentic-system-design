import type { Rule } from "../scripts/verify";
import { asList, block, designData, isFilled, readDesign, wordCount } from "./lib/design";

// One row in the Failures block. A learner may leave any field out, so every field is optional.
type Failure = {
  failure?: unknown;
  kind?: unknown;
  showsUpAs?: unknown;
  caughtBy?: unknown;
  systemDoes?: unknown;
};

// The five kinds of failure every agent design must plan for.
export const FAILURE_KINDS = [
  "model-wrong",
  "tool-fails",
  "person-silent",
  "record-disagrees",
  "cost-runaway",
];
const FEWEST_ROWS = 5;

// Words that mean "someone will notice", which is a hope, not a check.
const VAGUE_CATCH = /monitor|observab|dashboard|keep an eye|eyeball|someone (will )?notice/i;

const failuresOf = (folder: string) =>
  asList<Failure>(designData<{ failures?: unknown }>(folder, "Failures")?.failures);

function rowIsComplete(row: Failure): boolean {
  const sentences = [row.showsUpAs, row.caughtBy, row.systemDoes];
  const longEnough = sentences.every((sentence) => wordCount(sentence) >= 5);
  return isFilled(row.failure) && FAILURE_KINDS.includes(String(row.kind)) && longEnough;
}

// A catch names a check: what it reads and what it compares. "Monitoring" is not a check.
function namesOneCheck(row: Failure): boolean {
  const caughtBy = String(row.caughtBy ?? "");
  return /\bchecks?\b/i.test(caughtBy) && !VAGUE_CATCH.test(caughtBy);
}

export default [
  {
    says: "design.md has a Failures section with a yaml design block",
    test: (folder) => block(readDesign(folder), "Failures").ok,
    tryNext:
      "fill the yaml design block under ## Failures in design.md; " +
      "keep the fence line ```yaml design",
  },
  {
    says: "five failures or more, each with a kind, how it shows, how it is caught, what happens",
    test: (folder) => {
      const rows = failuresOf(folder);
      return rows.length >= FEWEST_ROWS && rows.every(rowIsComplete);
    },
    tryNext:
      "give each row failure:, kind:, and shows_up_as:, caught_by: and system_does: " +
      "of at least 5 words each; write five rows or more",
  },
  {
    says: "there is one failure of each of the five kinds",
    test: (folder) => {
      const kinds = failuresOf(folder).map((row) => String(row.kind));
      return FAILURE_KINDS.every((kind) => kinds.includes(kind));
    },
    tryNext: `use each kind at least once: ${FAILURE_KINDS.join(", ")}`,
  },
  {
    says: "every caught_by names a check, never monitoring",
    test: (folder) => {
      const rows = failuresOf(folder);
      return rows.length > 0 && rows.every(namesOneCheck);
    },
    tryNext:
      "write caught_by: as a check that reads something and compares it, " +
      "such as a check reads meter_reads before every close",
  },
] satisfies Rule[];
