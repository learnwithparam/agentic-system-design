import type { Rule } from "../scripts/verify";
import { asList, block, designData, readDesign, wordCount } from "./lib/design";
import { readDesk } from "./lib/world";

type Evaluation = {
  job?: unknown;
  question?: unknown;
  cases?: unknown;
  source?: unknown;
  grader?: unknown;
  checkedByPerson?: unknown;
  passMark?: unknown;
  coversRules?: unknown;
  gate?: unknown;
};

export const GRADERS = ["code", "model", "person"];
export const GATES = ["block-release", "warn"];

const evalsOf = (folder: string) =>
  asList<Evaluation>(designData<{ evals?: unknown }>(folder, "Evals")?.evals);
const isPositive = (value: unknown) => typeof value === "number" && value > 0;

async function machineJobs(): Promise<string[]> {
  const desk = await readDesk();
  return desk.jobs.filter((job) => !job.reservedForPerson).map((job) => job.id);
}

export default [
  {
    says: "design.md has an Evals section with a yaml design block",
    test: (folder) => block(readDesign(folder), "Evals").ok,
    tryNext: "fill the yaml design block under ## Evals in design.md; keep the fence line",
  },
  {
    says: "every job a machine does has an eval with a question and a source",
    test: async (folder) => {
      const jobs = await machineJobs();
      return jobs.every((jobName) => {
        const entry = evalsOf(folder).find((item) => item.job === jobName);
        return wordCount(entry?.question) >= 4 && wordCount(entry?.source) >= 3;
      });
    },
    tryNext: "add an eval for each job in world/desk.yaml that is not reserved for a person",
  },
  {
    says: "each eval has at least ten cases and a grader that is code, a model or a person",
    test: (folder) => {
      const entries = evalsOf(folder);
      const isGood = (entry: Evaluation) =>
        typeof entry.cases === "number" &&
        entry.cases >= 10 &&
        GRADERS.includes(String(entry.grader));
      return entries.length > 0 && entries.every(isGood);
    },
    tryNext: "set cases: to a number of at least 10 and grader: to code, model or person",
  },
  {
    says: "a model grader is checked by a person on some of the cases",
    test: (folder) => {
      const graded = evalsOf(folder).filter((entry) => entry.grader === "model");
      return graded.every((entry) => isPositive(entry.checkedByPerson));
    },
    tryNext: "add checked_by_person: with the number of cases a person reads to trust the model",
  },
  {
    says: "each pass mark is above 0 and at most 1, and each eval can block a release",
    test: (folder) => {
      const entries = evalsOf(folder);
      const isGood = (entry: Evaluation) => {
        const mark = entry.passMark;
        return typeof mark === "number" && mark > 0 && mark <= 1 && entry.gate === "block-release";
      };
      return entries.length > 0 && entries.every(isGood);
    },
    tryNext: "write pass_mark: as a share such as 0.9, and gate: block-release",
  },
  {
    says: "the evals cover every hard rule a machine could break",
    test: async (folder) => {
      const desk = await readDesk();
      const needed = desk.hardRules.map((rule) => rule.id).filter((id) => id !== "P1");
      const covered = evalsOf(folder).flatMap((entry) => asList<unknown>(entry.coversRules));
      return needed.every((id) => covered.includes(id));
    },
    tryNext: "add covers_rules: [P2, P3] to the eval for plan-the-crews; see world/policy.md",
  },
] satisfies Rule[];
