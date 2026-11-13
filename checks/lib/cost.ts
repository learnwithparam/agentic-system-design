// Pricing a design: the cost per outcome from the model calls a design makes, at the list prices
// in config/models.ts, and the monthly cost at the volumes in world/desk.yaml.
import { priceFor, type Role } from "../../config/models";

// One kind of model call in a design, such as one fast call per report.
export type ModelCall = {
  job: string;
  role: Role;
  callsPerOutcome: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

// The cost in US dollars of the calls one outcome needs, or null when the role has no price.
export function callCost(call: ModelCall): number | null {
  const price = priceFor("anthropic", call.role);
  if (!price) return null;
  const freshInput = Math.max(0, call.inputTokens - call.cachedInputTokens);
  const inputCost = freshInput * price.input + call.cachedInputTokens * price.cachedInput;
  const oneCall = inputCost + call.outputTokens * price.output;
  return (call.callsPerOutcome * oneCall) / 1e6;
}

export function costPerOutcome(calls: ModelCall[]): number | null {
  let total = 0;
  for (const call of calls) {
    const cost = callCost(call);
    if (cost === null) return null;
    total += cost;
  }
  return total;
}

export const monthly = (perOutcome: number, outcomesPerMonth: number) =>
  perOutcome * outcomesPerMonth;
