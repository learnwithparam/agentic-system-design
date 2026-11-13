import { existsSync } from "node:fs";
import { join } from "node:path";
import { allSteps, ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";
import { asList, block, designData, isFilled, readDesign, wordCount } from "./lib/design";

// One choice in the review request. A learner may leave any field out.
type Choice = {
  choice?: unknown;
  section?: unknown;
  whyRisky?: unknown;
  wouldChangeMyMind?: unknown;
};

const THIS_STEP = "defend-the-design";
const RISKIEST_CHOICES = 3;

// These steps check other files (first-look.md, review-<case>.md), not the finished design.
const NOT_ON_THE_DESIGN = ["meet-the-outage-desk", "review-a-real-system"];

// Every step before this one whose check reads the design, cost.yaml or adr/.
function earlierStepNames(): string[] {
  const names = allSteps().map((step) => step.name);
  const before = names.slice(0, names.indexOf(THIS_STEP));
  return before.filter((name) => !NOT_ON_THE_DESIGN.includes(name));
}

async function passesEveryRule(rules: Rule[], folder: string): Promise<boolean> {
  for (const rule of rules) {
    const holds = await Promise.resolve(rule.test(folder)).catch(() => false);
    if (!holds) return false;
  }
  return true;
}

// One rule for each earlier step: the finished files still pass all of that step's rules.
async function earlierStepRules(): Promise<Rule[]> {
  const rules: Rule[] = [];
  for (const name of earlierStepNames()) {
    const checkFile = join(ROOT, "checks", `${name}.ts`);
    if (!existsSync(checkFile)) continue;
    const stepRules: Rule[] = (await import(checkFile)).default;
    rules.push({
      says: `the finished files pass every rule of ${name}`,
      test: (folder) => passesEveryRule(stepRules, folder),
      tryNext: `fix these files until they meet every rule in the ${name} step`,
    });
  }
  return rules;
}

const choicesOf = (folder: string) =>
  asList<Choice>(
    designData<{ choices?: unknown }>(folder, "Riskiest choices", "review-request.md")?.choices,
  );

// A choice points at a section of design.md, such as Gates, or at cost.yaml.
function pointsAtSomethingReal(folder: string, choice: Choice): boolean {
  const target = String(choice.section ?? "");
  if (target === "cost.yaml") return existsSync(join(folder, "cost.yaml"));
  return isFilled(target) && block(readDesign(folder), target).ok;
}

// What would change your mind is something you could count, so it holds a number.
const holdsNumber = (choice: Choice) =>
  wordCount(choice.wouldChangeMyMind) >= 10 && /\d/.test(String(choice.wouldChangeMyMind));

const reviewRequestRules: Rule[] = [
  {
    says: "review-request.md lists exactly three riskiest choices",
    test: (folder) => {
      const design = readDesign(folder, "review-request.md");
      const hasBlock = block(design, "Riskiest choices").ok;
      return hasBlock && choicesOf(folder).length === RISKIEST_CHOICES;
    },
    tryNext:
      "fill the yaml design block under ## Riskiest choices in review-request.md " +
      "with three choices: the ones a reviewer should push on first",
  },
  {
    says: "every choice points at a design section or cost.yaml, and says why it is risky",
    test: (folder) => {
      const choices = choicesOf(folder);
      const complete = (choice: Choice) =>
        isFilled(choice.choice) && wordCount(choice.whyRisky) >= 8;
      return (
        choices.length > 0 &&
        choices.every((choice) => complete(choice) && pointsAtSomethingReal(folder, choice))
      );
    },
    tryNext:
      "set section: to a heading in design.md (such as Gates) or to cost.yaml, " +
      "and write why_risky: in at least 8 words",
  },
  {
    says: "every choice says what would change your mind, with a number you could measure",
    test: (folder) => {
      const choices = choicesOf(folder);
      return choices.length > 0 && choices.every(holdsNumber);
    },
    tryNext:
      "write would_change_my_mind: as something you could count, such as " +
      "more than 40 gates in one storm night shift",
  },
];

export default [...(await earlierStepRules()), ...reviewRequestRules] satisfies Rule[];
