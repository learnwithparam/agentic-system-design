import type { Rule } from "../scripts/verify";
import { asList, block, designData, isFilled, readDesign, wordCount } from "./lib/design";
import { PATTERN_RANK, PATTERNS_FOR_RUNG, TOKEN_MULTIPLIER } from "./lib/ladder";
import { readDesk } from "./lib/world";

// One job in the Pattern block. A learner may leave any field out, so every field is optional.
type PatternChoice = {
  job?: unknown;
  pattern?: string;
  rejected?: string;
  whyNotSimpler?: unknown;
  tokenMultiplier?: unknown;
};

type ShapeJob = { job?: unknown; rung?: string };

const patternChoices = (folder: string) =>
  asList<PatternChoice>(designData<{ patterns?: unknown }>(folder, "Pattern")?.patterns);

// The rung the learner gave this job in the Shape section.
function rungOf(folder: string, job: unknown): string | undefined {
  const shapeJobs = asList<ShapeJob>(designData<{ jobs?: unknown }>(folder, "Shape")?.jobs);
  return shapeJobs.find((shapeJob) => shapeJob.job === job)?.rung;
}

// The jobs a machine does: every pattern except a person.
const machineChoices = (folder: string) =>
  patternChoices(folder).filter((choice) => choice.pattern !== "person");

function fitsItsRung(folder: string, choice: PatternChoice): boolean {
  const allowed = PATTERNS_FOR_RUNG[rungOf(folder, choice.job) as string] ?? [];
  return allowed.includes(choice.pattern as string);
}

function rejectsSomethingSimpler(choice: PatternChoice): boolean {
  const rejected = choice.rejected as string;
  if (!(rejected in PATTERN_RANK)) return false;
  return PATTERN_RANK[rejected] < PATTERN_RANK[choice.pattern as string];
}

// An agent pattern states a token multiplier inside the published range. Other patterns pass.
function multiplierInRange(choice: PatternChoice): boolean {
  const range = TOKEN_MULTIPLIER[choice.pattern as string];
  if (!range) return true;
  const multiplier = choice.tokenMultiplier;
  const [lowest, highest] = range;
  return typeof multiplier === "number" && multiplier >= lowest && multiplier <= highest;
}

export default [
  {
    says: "design.md has a Pattern section with a yaml design block, after a Shape section",
    test: (folder) => {
      const design = readDesign(folder);
      return block(design, "Shape").ok && block(design, "Pattern").ok;
    },
    tryNext: "keep your ## Shape section and fill the yaml design block under ## Pattern",
  },
  {
    says: "every job on the desk has exactly one pattern",
    test: async (folder) => {
      const wanted = (await readDesk()).jobs.map((job) => job.id).sort();
      const written = patternChoices(folder)
        .map((choice) => String(choice.job))
        .sort();
      return JSON.stringify(wanted) === JSON.stringify(written);
    },
    tryNext: "list each job from your Shape section once under patterns:",
  },
  {
    says: "every pattern is on the list and fits the job's rung in Shape",
    test: (folder) => {
      const choices = patternChoices(folder);
      return choices.length > 0 && choices.every((choice) => fitsItsRung(folder, choice));
    },
    tryNext:
      "a workflow uses chain, route, parallel, orchestrator-workers or evaluator-optimizer; " +
      "one-call uses single-call; agent uses agent-loop; person uses person",
  },
  {
    says: "every machine job names a simpler pattern it rejected",
    test: (folder) => {
      const choices = machineChoices(folder);
      return choices.length > 0 && choices.every(rejectsSomethingSimpler);
    },
    tryNext:
      "set rejected: to the next simpler pattern you considered (none for a single-call job)",
  },
  {
    says: "every machine job says why the simpler pattern fails, in at least 10 words",
    test: (folder) => {
      const choices = machineChoices(folder);
      return (
        choices.length > 0 &&
        choices.every((choice) => {
          return isFilled(choice.whyNotSimpler) && wordCount(choice.whyNotSimpler) >= 10;
        })
      );
    },
    tryNext:
      "under why_not_simpler: name the fact of the storm desk that breaks the simpler pattern",
  },
  {
    says: "every agent pattern states its token multiplier against a chat, in the published range",
    test: (folder) => patternChoices(folder).every(multiplierInRange),
    tryNext:
      "Anthropic measured about 4 times the tokens of a chat for one agent " +
      "and about 15 times for many agents; set token_multiplier: to match",
  },
] satisfies Rule[];
