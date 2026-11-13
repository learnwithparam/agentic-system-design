// The LiteLLM release the closing part reads prices from. The cost map snapshot next to this file
// is model_prices_and_context_window_backup.json from the litellm 1.109.1 package on PyPI,
// read on 13 Nov 2026, cut down to the claude and gpt models.
// Prices are US dollars per token, as LiteLLM publishes them.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const LITELLM_VERSION = "1.109.1";

export type TokenPrice = { input: number; cachedInput: number; output: number };

export function readCostMap(): Map<string, TokenPrice> {
  const path = join(import.meta.dir, "litellm-cost-map.csv");
  const lines = readFileSync(path, "utf8").trim().split("\n").slice(1);
  const costMap = new Map<string, TokenPrice>();
  for (const line of lines) {
    const [modelKey, input, cachedInput, output] = line.split(",");
    costMap.set(modelKey, {
      input: Number(input),
      cachedInput: Number(cachedInput),
      output: Number(output),
    });
  }
  return costMap;
}
