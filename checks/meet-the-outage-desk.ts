import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { finishedBoards, readDesk, sameBoards } from "./lib/world";

const firstLookFile = (folder: string) => join(folder, "first-look.md");

// The text after "Name:" on its own line in first-look.md, or null when it is missing or blank.
function field(folder: string, name: string): string | null {
  if (!existsSync(firstLookFile(folder))) return null;
  const text = readFileSync(firstLookFile(folder), "utf8");
  const line = text.match(new RegExp(`^${name}:[ \\t]*(.*)$`, "mi"));
  const value = line?.[1].trim();
  return value ? value : null;
}

// The first number in a field, so "$0.15" and "92%" both read as numbers. NaN when there is none.
function numberIn(value: string | null): number {
  if (!value) return Number.NaN;
  const digits = value.replace(/[$,%]/g, "").match(/-?\d+(\.\d+)?/)?.[0];
  return Number(digits ?? Number.NaN);
}

const fieldNumber = (folder: string, name: string) => numberIn(field(folder, name));
const firstBoard = async () => (await finishedBoards(3))[0];

export default [
  {
    says: "first-look.md exists",
    test: (folder) => existsSync(firstLookFile(folder)),
    tryNext: "write first-look.md in this problem folder; the starter has the five lines to fill",
  },
  {
    says: "the finished system gives the same board on three fresh replay runs",
    test: async () => sameBoards(await finishedBoards(3)),
    tryNext:
      "run bun run world reset, then bun run storm; " +
      "if the boards differ, see 00-orientation/troubleshooting.md",
  },
  {
    says: "the finished system never closed an outage while meters were dark, in any run",
    test: async () => (await finishedBoards(3)).every((board) => board.closedWhileDark === 0),
    tryNext: "run git checkout finished/ to restore the sample design, then run the check again",
  },
  {
    says: "Outages found matches the board",
    test: async (folder) => {
      return fieldNumber(folder, "Outages found") === (await firstBoard()).outagesFound;
    },
    tryNext: "run bun run storm and copy the first number of the Outages found line",
  },
  {
    says: "Reports attached to the right outage matches the board",
    test: async (folder) => {
      const written = fieldNumber(folder, "Reports attached to the right outage");
      return Math.abs(written - (await firstBoard()).reportsAttachedRightPercent) < 0.6;
    },
    tryNext: "copy the percent from the Reports attached to the right outage line",
  },
  {
    says: "Model cost of the storm night matches the board",
    test: async (folder) => {
      const written = fieldNumber(folder, "Model cost of the storm night");
      return Math.abs(written - (await firstBoard()).modelCostUsd) < 0.011;
    },
    tryNext: "copy the dollar amount from the Model cost of the storm night line",
  },
  {
    says: "Must-never actions blocked matches the board",
    test: async (folder) => {
      return (
        fieldNumber(folder, "Must-never actions blocked") === (await firstBoard()).mustNeverBlocked
      );
    },
    tryNext:
      "copy the number from the Must-never actions blocked line, " +
      "then read world/state/events.jsonl for the blocked lines",
  },
  {
    says: "The job you think needs an agent names one of the desk's jobs",
    test: async (folder) => {
      const answer = field(folder, "The job you think needs an agent") ?? "";
      const { jobs } = await readDesk();
      return jobs.some((job) => answer.includes(job.id));
    },
    tryNext: "pick one job id from world/desk.yaml, such as plan-the-crews",
  },
] satisfies Rule[];
