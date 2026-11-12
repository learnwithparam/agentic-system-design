// What the checks know about the world: the desk's jobs and rules, the OMS tables, and the finished system's
// result. Every value comes from world/ files or from the OMS and logs after a run, never from a model's reply.
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ROOT } from "../../scripts/structure";
import { reset, tables as omsTables } from "../../world/lib/oms";
import { computeBoard, type Board } from "../../finished/board";

export type Job = { id: string; what: string; reserved_for_person: boolean };
export type HardRule = { id: string; rule: string; keywords: string[] };
export type Desk = {
  company: string;
  system_of_record: string;
  jobs: Job[];
  hard_rules: HardRule[];
  volumes: Record<string, Record<string, number>> & { desk_lead_shift_minutes: number };
};

let desk: Desk | undefined;
export async function readDesk(): Promise<Desk> {
  if (!desk) desk = Bun.YAML.parse(await Bun.file(join(ROOT, "world", "desk.yaml")).text()) as Desk;
  return desk;
}

let tableCache: string[] | undefined;
// The tables of a freshly seeded OMS: the records a design may name as its system of record.
export function recordTables(): string[] {
  if (!tableCache) {
    const dir = mkdtempSync(join(tmpdir(), "copperbeck-tables-"));
    reset(dir);
    tableCache = omsTables(dir);
  }
  return tableCache;
}

// Run the finished system in fresh state folders, in replay mode, and read each board from the OMS and logs.
// A behaviour that depends on a model is judged over three fresh runs.
const boards = new Map<number, Board[]>();
export async function finishedBoards(runs = 3): Promise<Board[]> {
  if (boards.has(runs)) return boards.get(runs)!;
  const out: Board[] = [];
  for (let i = 0; i < runs; i++) {
    const dir = mkdtempSync(join(tmpdir(), "copperbeck-run-"));
    const p = Bun.spawnSync(["bun", join(ROOT, "finished", "storm.ts"), "--quiet"], {
      cwd: ROOT,
      env: { ...process.env, LLM_PROVIDER: "replay", WORLD_STATE: dir },
      stdout: "ignore",
      stderr: "ignore",
    });
    if (p.exitCode !== 0) throw new Error(`the finished system failed to run (exit ${p.exitCode})`);
    out.push(computeBoard(dir));
  }
  boards.set(runs, out);
  return out;
}

export const sameBoards = (bs: Board[]) => bs.every((b) => JSON.stringify(b) === JSON.stringify(bs[0]));
