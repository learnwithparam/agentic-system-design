import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { priceFor, ROLES, type Role } from "../config/models";
import type { Rule } from "../scripts/verify";
import { withCamelCaseNames } from "../world/lib/field-names";
import { costPerOutcome, type ModelCall, monthly } from "./lib/cost";
import { asList, designData, isFilled } from "./lib/design";
import { finishedBoards, readDesk } from "./lib/world";

// cost.yaml as the learner writes it. A learner may leave any field out.
export type CostFile = {
  outcome?: unknown;
  valuePerOutcomeUsd?: unknown;
  monthlyBudgetUsd?: unknown;
  calls?: unknown;
};

type ShapeJob = { job?: unknown; rung?: unknown };

// A design may differ from the sample, so its cost may be up to four times lower or higher
// than the finished system's measured cost per outage. A missing zero lands outside that range.
export const RANGE_FACTOR = 4;

// cost.yaml read into data, or undefined when it is missing or not valid YAML.
export function readCostFile(folder: string): CostFile | undefined {
  const path = join(folder, "cost.yaml");
  if (!existsSync(path)) return undefined;
  try {
    const data = Bun.YAML.parse(readFileSync(path, "utf8"));
    if (data === null || typeof data !== "object") return undefined;
    return withCamelCaseNames<CostFile>(data);
  } catch {
    return undefined;
  }
}

const isCount = (value: unknown) => typeof value === "number" && value >= 0;

function callIsComplete(call: ModelCall, jobIds: string[]): boolean {
  const counts = [
    call.callsPerOutcome,
    call.inputTokens,
    call.cachedInputTokens,
    call.outputTokens,
  ];
  const hasPrice =
    ROLES.includes(call.role as Role) && priceFor("anthropic", call.role) !== undefined;
  return (
    jobIds.includes(String(call.job)) &&
    hasPrice &&
    counts.every(isCount) &&
    call.callsPerOutcome > 0 &&
    call.cachedInputTokens <= call.inputTokens
  );
}

export const callsOf = (costFile: CostFile | undefined) => asList<ModelCall>(costFile?.calls);

// The cost of one outcome in US dollars, or undefined when a call cannot be priced.
export async function outcomeCost(folder: string): Promise<number | undefined> {
  const costFile = readCostFile(folder);
  const calls = callsOf(costFile);
  const jobIds = (await readDesk()).jobs.map((job) => job.id);
  if (calls.length === 0 || !calls.every((call) => callIsComplete(call, jobIds))) return undefined;
  return costPerOutcome(calls) ?? undefined;
}

// Jobs on any rung but person: each one makes at least one model call.
function machineJobs(folder: string): string[] {
  const jobs = asList<ShapeJob>(designData<{ jobs?: unknown }>(folder, "Shape")?.jobs);
  return jobs.filter((job) => job.rung !== "person").map((job) => String(job.job));
}

async function stormMonthFits(folder: string): Promise<boolean> {
  const cost = await outcomeCost(folder);
  const budget = readCostFile(folder)?.monthlyBudgetUsd;
  const { volumes } = await readDesk();
  if (cost === undefined || typeof budget !== "number") return false;
  return monthly(cost, volumes.stormMonth.outages) <= budget;
}

// The finished system's measured cost per outage, the same over three fresh replay runs.
export async function measuredCostPerOutage(): Promise<number> {
  const boards = await finishedBoards(3);
  const costs = boards.map((board) => board.costPerOutageUsd);
  return costs.reduce((total, cost) => total + cost, 0) / costs.length;
}

async function nearTheMeasuredCost(folder: string): Promise<boolean> {
  const cost = await outcomeCost(folder);
  if (cost === undefined) return false;
  const measured = await measuredCostPerOutage();
  return cost >= measured / RANGE_FACTOR && cost <= measured * RANGE_FACTOR;
}

export default [
  {
    says: "cost.yaml has an outcome, a value per outcome, a monthly budget and calls",
    test: (folder) => {
      const costFile = readCostFile(folder);
      const value = costFile?.valuePerOutcomeUsd;
      const budget = costFile?.monthlyBudgetUsd;
      const numbers = typeof value === "number" && typeof budget === "number";
      return isFilled(costFile?.outcome) && numbers && callsOf(costFile).length > 0;
    },
    tryNext:
      "fill cost.yaml next to design.md: outcome:, value_per_outcome_usd:, " +
      "monthly_budget_usd: and a calls: list",
  },
  {
    says: "every call names a job on the desk, a priced role and its tokens",
    test: async (folder) => (await outcomeCost(folder)) !== undefined,
    tryNext:
      "give each call job:, role: (fast or smart), calls_per_outcome: above 0, input_tokens:, " +
      "cached_input_tokens: (no more than input_tokens) and output_tokens:",
  },
  {
    says: "every job on a machine rung in Shape has a call",
    test: (folder) => {
      const priced = callsOf(readCostFile(folder)).map((call) => String(call.job));
      const jobs = machineJobs(folder);
      return jobs.length > 0 && jobs.every((job) => priced.includes(job));
    },
    tryNext:
      "add a call for each job that is not on the person rung, " +
      "such as plan-the-crews with role: smart",
  },
  {
    says: "the cost per outcome is below the value per outcome",
    test: async (folder) => {
      const cost = await outcomeCost(folder);
      const value = readCostFile(folder)?.valuePerOutcomeUsd;
      return cost !== undefined && typeof value === "number" && cost < value;
    },
    tryNext:
      "say what one handled outage is worth to Copperbeck in value_per_outcome_usd:, " +
      "or cut calls until the cost is below it",
  },
  {
    says: "the storm month (420 outages) stays under the monthly budget",
    test: stormMonthFits,
    tryNext:
      "run the price board to see the storm month cost, " +
      "then raise monthly_budget_usd: or cut calls per outcome",
  },
  {
    says: "the cost per outcome is within four times of the finished system's measured cost",
    test: nearTheMeasuredCost,
    tryNext:
      "compare your tokens with the ledger of bun run storm: " +
      "a missing or extra zero puts the cost far from what the sample design spends",
  },
] satisfies Rule[];
