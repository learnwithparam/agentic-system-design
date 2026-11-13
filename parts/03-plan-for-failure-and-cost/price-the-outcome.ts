// The price board: what one outcome and one month of outcomes cost, from cost.yaml.
//   bun parts/03-plan-for-failure-and-cost/price-the-outcome.ts            your work
//   bun parts/03-plan-for-failure-and-cost/price-the-outcome.ts solution   the sample answer
// Prices come from config/models.ts, volumes from world/desk.yaml. No model is called.
import { join } from "node:path";
import { callCost, type ModelCall, monthly } from "../../checks/lib/cost";
import { readDesk } from "../../checks/lib/world";
import { callsOf, readCostFile } from "../../checks/price-the-outcome";
import { PRICES_READ_ON } from "../../config/models";

const STEP_FOLDER = join(import.meta.dir, "03-price-the-outcome");

const dollars = (amount: number, places = 2) => `$${amount.toFixed(places)}`;
const row = (label: string, value: string) => `  ${label.padEnd(48)}${value}`;

function chosenFolder(): string {
  const argument = process.argv[2];
  if (argument === "solution") return join(STEP_FOLDER, "solution");
  if (argument) return argument;
  return join(STEP_FOLDER, "problem");
}

function stopWith(message: string): never {
  console.log(message);
  process.exit(1);
}

// One line per call, and the total cost of one outcome.
function printCalls(calls: ModelCall[]): number {
  let total = 0;
  for (const call of calls) {
    const cost = callCost(call);
    if (cost === null) stopWith("A call in cost.yaml has no priced role yet. Use fast or smart.");
    total += cost;
    const label = `${call.job} (${call.role}, ${call.callsPerOutcome} calls)`;
    console.log(row(label, dollars(cost, 5)));
  }
  return total;
}

function verdict(cost: number, limit: number) {
  return cost <= limit ? "fits" : "OVER";
}

async function printBoard(folder: string) {
  const costFile = readCostFile(folder);
  if (!costFile) stopWith(`No cost.yaml in ${folder}, or it is not valid YAML.`);
  const calls = callsOf(costFile);
  if (calls.length === 0)
    stopWith("cost.yaml has no calls yet. Add one call for each machine job.");
  const value = Number(costFile.valuePerOutcomeUsd) || 0;
  const budget = Number(costFile.monthlyBudgetUsd) || 0;
  const { volumes } = await readDesk();
  console.log(
    `Price board for ${String(costFile.outcome)} (list prices read on ${PRICES_READ_ON})`,
  );
  const perOutcome = printCalls(calls);
  const normalMonth = monthly(perOutcome, volumes.normalMonth.outages);
  const stormMonth = monthly(perOutcome, volumes.stormMonth.outages);
  console.log(row("Cost per outcome", dollars(perOutcome, 5)));
  console.log(row("Value per outcome", `${dollars(value)} (${verdict(perOutcome, value)})`));
  console.log(row(`Normal month, ${volumes.normalMonth.outages} outages`, dollars(normalMonth)));
  const stormLabel = `Storm month, ${volumes.stormMonth.outages} outages`;
  const stormVerdict = `of ${dollars(budget)} budget (${verdict(stormMonth, budget)})`;
  console.log(row(stormLabel, `${dollars(stormMonth)} ${stormVerdict}`));
}

await printBoard(chosenFolder());
