import type { Rule } from "../scripts/verify";
import { block, data, filled, list, read, words } from "./lib/design";
import { PATTERNS_FOR_RUNG, PATTERN_RANK, TOKEN_MULTIPLIER } from "./lib/ladder";
import { readDesk } from "./lib/world";

const patterns = (d: string) => list(data(d, "Pattern")?.patterns);
const rungOf = (d: string, job: string) => list(data(d, "Shape")?.jobs).find((j) => j.job === job)?.rung;
const machine = (d: string) => patterns(d).filter((p) => p.pattern !== "person");

export default [
  {
    says: "design.md has a Pattern section with a yaml design block, after a Shape section",
    test: (d) => block(read(d), "Shape").ok && block(read(d), "Pattern").ok,
    tryNext: "keep your ## Shape section and fill the yaml design block under ## Pattern",
  },
  {
    says: "every job on the desk has exactly one pattern",
    test: async (d) => {
      const want = (await readDesk()).jobs.map((j) => j.id).sort();
      return JSON.stringify(want) === JSON.stringify(patterns(d).map((p) => String(p.job)).sort());
    },
    tryNext: "list each job from your Shape section once under patterns:",
  },
  {
    says: "every pattern is on the list and fits the job's rung in Shape",
    test: (d) => patterns(d).length > 0 && patterns(d).every((p) => (PATTERNS_FOR_RUNG[rungOf(d, p.job)] ?? []).includes(p.pattern)),
    tryNext: "a workflow uses chain, route, parallel, orchestrator-workers or evaluator-optimizer; one-call uses single-call; agent uses agent-loop; person uses person",
  },
  {
    says: "every machine job names a simpler pattern it rejected",
    test: (d) => machine(d).length > 0 && machine(d).every((p) => p.rejected in PATTERN_RANK && PATTERN_RANK[p.rejected] < PATTERN_RANK[p.pattern]),
    tryNext: "set rejected: to the next simpler pattern you considered (none for a single-call job)",
  },
  {
    says: "every machine job says why the simpler pattern fails, in at least 10 words",
    test: (d) => machine(d).length > 0 && machine(d).every((p) => filled(p.why_not_simpler) && words(p.why_not_simpler) >= 10),
    tryNext: "under why_not_simpler: name the fact of the storm desk that breaks the simpler pattern",
  },
  {
    says: "every agent pattern states its token multiplier against a chat, in the published range",
    test: (d) =>
      patterns(d).every((p) => {
        const r = TOKEN_MULTIPLIER[p.pattern];
        return !r || (typeof p.token_multiplier === "number" && p.token_multiplier >= r[0] && p.token_multiplier <= r[1]);
      }),
    tryNext: "Anthropic measured about 4 times the tokens of a chat for one agent and about 15 times for many agents; set token_multiplier: to match",
  },
] satisfies Rule[];
