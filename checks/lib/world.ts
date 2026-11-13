// What the checks know about the world: the desk's jobs and rules, the OMS tables,
// and the finished system's result. Every value comes from world/ files, or from the OMS and logs
// after a run. None comes from a model's reply.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Board, computeBoard } from "../../finished/board";
import { ROOT } from "../../scripts/structure";
import { withCamelCaseNames } from "../../world/lib/field-names";
import { tables as omsTables, reset } from "../../world/lib/oms";

export type Job = { id: string; what: string; reservedForPerson: boolean };
export type HardRule = { id: string; rule: string; keywords: string[] };
export type Desk = {
  company: string;
  systemOfRecord: string;
  jobs: Job[];
  hardRules: HardRule[];
  volumes: Record<string, Record<string, number>> & { deskLeadShiftMinutes: number };
};

let desk: Desk | undefined;

// world/desk.yaml, read once.
export async function readDesk(): Promise<Desk> {
  if (!desk) {
    const text = await Bun.file(join(ROOT, "world", "desk.yaml")).text();
    desk = withCamelCaseNames<Desk>(Bun.YAML.parse(text));
  }
  return desk;
}

let tableNames: string[] | undefined;

// The tables of a freshly seeded OMS: the records a design may name as its system of record.
export function recordTables(): string[] {
  if (!tableNames) {
    const folder = mkdtempSync(join(tmpdir(), "copperbeck-tables-"));
    reset(folder);
    tableNames = omsTables(folder);
  }
  return tableNames;
}

const boards = new Map<number, Board[]>();

// The finished system runs on recorded replies, in its own state folder.
function replayEnvironment(stateFolder: string) {
  const environment = { ...process.env };
  environment.LLM_PROVIDER = "replay";
  environment.WORLD_STATE = stateFolder;
  return environment;
}

// Run the finished system in fresh state folders, in replay mode, and read each board
// from the OMS and logs. A behaviour that depends on a model is judged over three fresh runs.
export async function finishedBoards(runs = 3): Promise<Board[]> {
  const saved = boards.get(runs);
  if (saved) return saved;
  const results: Board[] = [];
  for (let i = 0; i < runs; i++) {
    const folder = mkdtempSync(join(tmpdir(), "copperbeck-run-"));
    const storm = Bun.spawnSync(["bun", join(ROOT, "finished", "storm.ts"), "--quiet"], {
      cwd: ROOT,
      env: replayEnvironment(folder),
      stdout: "ignore",
      stderr: "ignore",
    });
    if (storm.exitCode !== 0) {
      throw new Error(`the finished system failed to run (exit ${storm.exitCode})`);
    }
    results.push(computeBoard(folder));
  }
  boards.set(runs, results);
  return results;
}

export const sameBoards = (allBoards: Board[]) =>
  allBoards.every((board) => JSON.stringify(board) === JSON.stringify(allBoards[0]));
