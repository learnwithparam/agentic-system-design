// bun assignment/check.ts            check assignment/sheet.csv and write assignment/result.json
// bun assignment/check.ts --prove    CI: the sample answer passes and the untouched starter fails
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import rules, { versionFound } from "../checks/price-the-design";
import { LITELLM_VERSION } from "../config/litellm";

const assignmentFolder = import.meta.dir;
const solutionFolder = join(
  assignmentFolder,
  "..",
  "parts",
  "05-price-the-design-with-litellm",
  "01-price-the-design",
  "solution",
);

async function failedLines(folder: string): Promise<string[]> {
  const failed: string[] = [];
  for (const rule of rules) {
    const holds = await Promise.resolve(rule.test(folder)).catch(() => false);
    if (!holds) failed.push(rule.says);
  }
  return failed;
}

async function proveTheCheck(): Promise<never> {
  const onSolution = await failedLines(solutionFolder);
  const onStarter = await failedLines(assignmentFolder);
  if (onSolution.length > 0) console.log(`The sample answer fails: ${onSolution.join("; ")}`);
  if (onStarter.length === 0) console.log("The check passes on the untouched starter.");
  const proved = onSolution.length === 0 && onStarter.length > 0;
  if (proved) console.log("The assignment check passes the sample answer and fails the starter.");
  process.exit(proved ? 0 : 1);
}

async function checkTheSheet(): Promise<never> {
  const failed = await failedLines(assignmentFolder);
  const lines: Record<string, "pass" | "fail"> = {};
  for (const rule of rules) {
    const outcome = failed.includes(rule.says) ? "fail" : "pass";
    lines[rule.says] = outcome;
    console.log(`  ${outcome.toUpperCase()}  ${rule.says}`);
  }
  const result = {
    litellmVersionFound: versionFound(assignmentFolder),
    litellmVersionPinned: LITELLM_VERSION,
    lines,
  };
  writeFileSync(join(assignmentFolder, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
  process.exit(failed.length > 0 ? 1 : 0);
}

if (process.argv[2] === "--prove") await proveTheCheck();
await checkTheSheet();
