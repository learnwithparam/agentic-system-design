import type { Rule } from "../scripts/verify";
import { asList, block, designData, readDesign, wordCount } from "./lib/design";
import { readDesk } from "./lib/world";

type Stage = { name?: unknown; sharePercent?: unknown; whoActs?: unknown; advanceWhen?: unknown };
type StopRule = { metric?: unknown; limit?: unknown; rule?: unknown };
type Rollout = {
  rollout?: {
    stages?: unknown;
    stopWhen?: unknown;
    rollback?: { how?: unknown; owner?: unknown; tested?: unknown };
  };
};

const rolloutOf = (folder: string) => designData<Rollout>(folder, "Rollout")?.rollout ?? {};
const stagesOf = (folder: string) => asList<Stage>(rolloutOf(folder).stages);
const stopRulesOf = (folder: string) => asList<StopRule>(rolloutOf(folder).stopWhen);
const sharesOf = (folder: string) => stagesOf(folder).map((stage) => stage.sharePercent);

function sharesGrowToAll(folder: string): boolean {
  const shares = sharesOf(folder);
  if (shares.length < 3 || !shares.every((share) => typeof share === "number")) return false;
  const numbers = shares as number[];
  const growing = numbers.every((share, i) => i === 0 || share > numbers[i - 1]);
  return growing && numbers[numbers.length - 1] === 100;
}

export default [
  {
    says: "design.md has a Rollout section with a yaml design block",
    test: (folder) => block(readDesign(folder), "Rollout").ok,
    tryNext: "fill the yaml design block under ## Rollout in design.md; keep the fence line",
  },
  {
    says: "there are at least three stages, and the share of reports grows to 100",
    test: sharesGrowToAll,
    tryNext: "list stages such as shadow, small, wide and full, with share_percent rising to 100",
  },
  {
    says: "the first stage is small and a person acts on every result",
    test: (folder) => {
      const first = stagesOf(folder)[0];
      const share = first?.sharePercent;
      return typeof share === "number" && share <= 10 && first?.whoActs === "person";
    },
    tryNext: "start with share_percent of 10 or less and who_acts: person",
  },
  {
    says: "every stage says what must hold before the next one",
    test: (folder) => {
      const stages = stagesOf(folder);
      return stages.length > 0 && stages.every((stage) => wordCount(stage.advanceWhen) >= 6);
    },
    tryNext: "write advance_when: as a check, such as every eval holds its pass mark",
  },
  {
    says: "stop rules have a number, and cover every hard rule a machine could break",
    test: async (folder) => {
      const stops = stopRulesOf(folder);
      const allHaveNumbers = stops.every((stop) => typeof stop.limit === "number");
      const desk = await readDesk();
      const needed = desk.hardRules.map((rule) => rule.id).filter((id) => id !== "P1");
      const covered = stops.map((stop) => stop.rule);
      return stops.length >= 2 && allHaveNumbers && needed.every((id) => covered.includes(id));
    },
    tryNext: "give each stop rule a limit: number, and add rule: P2 and rule: P3 entries",
  },
  {
    says: "the way back is owned by a person and has been tried",
    test: (folder) => {
      const rollback = rolloutOf(folder).rollback ?? {};
      const ownedByPerson = rollback.owner === "person";
      return wordCount(rollback.how) >= 5 && ownedByPerson && rollback.tested === true;
    },
    tryNext: "write how:, set owner: person, and try the rollback before you set tested: true",
  },
] satisfies Rule[];
