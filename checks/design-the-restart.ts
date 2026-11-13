import type { Rule } from "../scripts/verify";
import { asList, block, designData, isFilled, readDesign } from "./lib/design";

type Tool = { name?: unknown; action?: unknown };
type KeyedWrite = { tool?: unknown; key?: unknown };
type Restart = {
  runState?: { livesIn?: unknown; resume?: unknown };
  idempotency?: unknown;
  budget?: { stepsPerRun?: unknown; dollarsPerRun?: unknown; whenHit?: unknown };
};

// Places outside the process, so run state survives when the process dies.
export const STATE_PLACES = ["oms", "database", "append-only-log", "durable-workflow", "file"];
export const WHEN_BUDGET_HIT = ["stop-and-ask"];

// A key with a clock time or a random id is new on every retry, so it stops nothing.
const CHANGES_EVERY_TRY = /random|uuid|guid|time|now|clock|counter|attempt/i;

const restartOf = (folder: string) => designData<Restart>(folder, "Restart") ?? {};
const keyedWrites = (folder: string) => asList<KeyedWrite>(restartOf(folder).idempotency);

function writeToolNames(folder: string): string[] {
  const tools = asList<Tool>(designData<{ tools?: unknown }>(folder, "Tools")?.tools);
  return tools.filter((tool) => tool.action === "write").map((tool) => String(tool.name));
}

function keyFor(folder: string, toolName: string): string | undefined {
  const keyed = keyedWrites(folder).find((write) => write.tool === toolName);
  return isFilled(keyed?.key) ? String(keyed?.key) : undefined;
}

// outage:crew is two fields of the action joined by a colon.
const isBuiltFromFields = (key: string) =>
  /^[a-z_]+(:[a-z_]+)*$/.test(key) && !CHANGES_EVERY_TRY.test(key);

function budgetIsComplete(folder: string): boolean {
  const budget = restartOf(folder).budget ?? {};
  const steps = budget.stepsPerRun;
  const dollars = budget.dollarsPerRun;
  const stepsSet = typeof steps === "number" && steps > 0;
  const dollarsSet = typeof dollars === "number" && dollars > 0;
  return stepsSet && dollarsSet && WHEN_BUDGET_HIT.includes(String(budget.whenHit));
}

export default [
  {
    says: "design.md has a Restart section with a yaml design block, after a Tools section",
    test: (folder) => {
      const design = readDesign(folder);
      return block(design, "Tools").ok && block(design, "Restart").ok;
    },
    tryNext: "keep your Tools section and fill the yaml design block under ## Restart",
  },
  {
    says: "run state lives outside the process, and the restart says how it resumes",
    test: (folder) => {
      const runState = restartOf(folder).runState ?? {};
      return STATE_PLACES.includes(String(runState.livesIn)) && isFilled(runState.resume);
    },
    tryNext:
      `set run_state: lives_in: to one of ${STATE_PLACES.join(", ")}, ` +
      "never memory, and say in resume: what a fresh process reads first",
  },
  {
    says: "every write tool in Tools has an idempotency key",
    test: (folder) => {
      const writes = writeToolNames(folder);
      return writes.length > 0 && writes.every((name) => keyFor(folder, name) !== undefined);
    },
    tryNext:
      "add each tool with action: write to idempotency: with a key:, " +
      "such as tool: crew_assign and key: outage:crew",
  },
  {
    says: "every key is built from the action's own fields, never a clock time or a random id",
    test: (folder) => {
      const keys = keyedWrites(folder).map((write) => String(write.key ?? ""));
      return keys.length > 0 && keys.every(isBuiltFromFields);
    },
    tryNext:
      "a random id or a time is new on every retry, so the retry runs again; " +
      "build the key from fields such as outage and crew, joined by a colon",
  },
  {
    says: "each run has a budget in steps and dollars, and stops to ask a person when it is hit",
    test: budgetIsComplete,
    tryNext:
      "set budget: steps_per_run: and dollars_per_run: to numbers above 0, " +
      "and when_hit: stop-and-ask",
  },
] satisfies Rule[];
