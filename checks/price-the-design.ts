import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LITELLM_VERSION, readCostMap } from "../config/litellm";
import type { Rule } from "../scripts/verify";
import { readDesk } from "./lib/world";

// One row of sheet.csv: a model call the design makes, and what the learner filled in for it.
export type SheetRow = Record<string, string>;

export function readSheet(folder: string): SheetRow[] {
  const path = join(folder, "sheet.csv");
  if (!existsSync(path)) return [];
  const [header, ...lines] = readFileSync(path, "utf8").trim().split("\n");
  const columns = header.split(",");
  return lines.map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(
      columns.map((column, index) => [column, (cells[index] ?? "").trim()]),
    );
  });
}

// The LiteLLM version the learner wrote down, or "" when the cells disagree or are empty.
export function versionFound(folder: string): string {
  const versions = new Set(readSheet(folder).map((row) => row.litellm_version));
  return versions.size === 1 ? [...versions][0] : "";
}

function priceCellsNameKeyAndVersion(folder: string): boolean {
  const rows = readSheet(folder);
  const costMap = readCostMap();
  if (rows.length === 0) return false;
  return rows.every((row) => costMap.has(row.model_key) && row.litellm_version === LITELLM_VERSION);
}

// The monthly cost of one row at the per-token prices of its model key.
function recomputedMonthly(row: SheetRow, outcomesPerMonth: number): number | undefined {
  const price = readCostMap().get(row.model_key);
  if (!price) return undefined;
  const input = Number(row.input_tokens);
  const cached = Number(row.cached_input_tokens);
  const output = Number(row.output_tokens);
  const oneCall =
    (input - cached) * price.input + cached * price.cachedInput + output * price.output;
  return Number(row.calls_per_outcome) * oneCall * outcomesPerMonth;
}

async function recomputedCostIsFilled(folder: string): Promise<boolean> {
  const rows = readSheet(folder);
  const outcomes = (await readDesk()).volumes.stormMonth.outages;
  if (rows.length === 0) return false;
  return rows.every((row) => {
    const expected = recomputedMonthly(row, outcomes);
    const written = Number(row.litellm_monthly_usd);
    if (expected === undefined || row.litellm_monthly_usd === "" || Number.isNaN(written)) {
      return false;
    }
    return Math.abs(written - expected) <= Math.max(0.0005, expected * 0.01);
  });
}

const rules: Rule[] = [
  {
    says: "every price cell names a model key from the LiteLLM cost map and the LiteLLM version",
    test: priceCellsNameKeyAndVersion,
    tryNext: `Write a key from the cost map and the version ${LITELLM_VERSION} on every row.`,
  },
  {
    says: "the recomputed monthly cost is filled in and matches the cost map prices",
    test: recomputedCostIsFilled,
    tryNext:
      "Multiply the tokens of a row by the prices of its key, then by the storm month outages.",
  },
];

export default rules;
