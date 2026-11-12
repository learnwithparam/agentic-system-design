import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { finishedBoards, readDesk, sameBoards } from "./lib/world";

const file = (d: string) => join(d, "first-look.md");
const field = (d: string, name: string): string | null => {
  if (!existsSync(file(d))) return null;
  const m = readFileSync(file(d), "utf8").match(new RegExp(`^${name}:[ \\t]*(.*)$`, "mi"));
  return m && m[1].trim() ? m[1].trim() : null;
};
const num = (s: string | null) => (s ? Number(s.replace(/[$,%]/g, "").match(/-?\d+(\.\d+)?/)?.[0] ?? NaN) : NaN);
const board = async () => (await finishedBoards(3))[0];

export default [
  {
    says: "first-look.md exists",
    test: (d) => existsSync(file(d)),
    tryNext: "write first-look.md in this problem folder; the starter has the five lines to fill",
  },
  {
    says: "the finished system gives the same board on three fresh replay runs",
    test: async () => sameBoards(await finishedBoards(3)),
    tryNext: "run bun run world reset, then bun run storm; if the boards differ, see 00-orientation/troubleshooting.md",
  },
  {
    says: "the finished system never closed an outage while meters were dark, in any run",
    test: async () => (await finishedBoards(3)).every((b) => b.closed_while_dark === 0),
    tryNext: "run git checkout finished/ to restore the sample design, then run the check again",
  },
  {
    says: "Outages found matches the board",
    test: async (d) => num(field(d, "Outages found")) === (await board()).outages_found,
    tryNext: "run bun run storm and copy the first number of the Outages found line",
  },
  {
    says: "Reports attached to the right outage matches the board",
    test: async (d) => Math.abs(num(field(d, "Reports attached to the right outage")) - (await board()).reports_attached_right_pct) < 0.6,
    tryNext: "copy the percent from the Reports attached to the right outage line",
  },
  {
    says: "Model cost of the storm night matches the board",
    test: async (d) => Math.abs(num(field(d, "Model cost of the storm night")) - (await board()).model_cost_usd) < 0.011,
    tryNext: "copy the dollar amount from the Model cost of the storm night line",
  },
  {
    says: "Must-never actions blocked matches the board",
    test: async (d) => num(field(d, "Must-never actions blocked")) === (await board()).must_never_blocked,
    tryNext: "copy the number from the Must-never actions blocked line, then read world/state/events.jsonl for the blocked lines",
  },
  {
    says: "The job you think needs an agent names one of the desk's jobs",
    test: async (d) => {
      const v = field(d, "The job you think needs an agent") ?? "";
      return (await readDesk()).jobs.some((j) => v.includes(j.id));
    },
    tryNext: "pick one job id from world/desk.yaml, such as plan-the-crews",
  },
] satisfies Rule[];
