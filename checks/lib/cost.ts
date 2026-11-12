// Pricing a design: cost per outcome from the model calls a design makes, at the list prices in
// config/models.ts, and the monthly cost at the volumes in world/desk.yaml.
import { priceFor, type Role } from "../../config/models";

export type ModelCall = { job: string; role: Role; calls_per_outcome: number; input_tokens: number; cached_input_tokens: number; output_tokens: number };

export function callCost(c: ModelCall): number | null {
  const p = priceFor("anthropic", c.role);
  if (!p) return null;
  const fresh = Math.max(0, c.input_tokens - c.cached_input_tokens);
  return (c.calls_per_outcome * (fresh * p.input + c.cached_input_tokens * p.cachedInput + c.output_tokens * p.output)) / 1e6;
}

export function costPerOutcome(calls: ModelCall[]): number | null {
  let sum = 0;
  for (const c of calls) {
    const x = callCost(c);
    if (x === null) return null;
    sum += x;
  }
  return sum;
}

export const monthly = (perOutcome: number, outcomes: number) => perOutcome * outcomes;
