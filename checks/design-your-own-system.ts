import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { asList, block, designData, isFilled, readDesign, wordCount } from "./lib/design";
import { RUNGS } from "./lib/ladder";

// This step reads only the learner's own file, my-system.md, and the evidence files it names.
// It never reads the course world, so it works for any system a learner brings.
const FILE = "my-system.md";
const FEWEST_TOOLS = 2;
const FEWEST_FAILURES = 3;
const FEWEST_EVIDENCE = 2;

type Row = Record<string, unknown>;

const data = <Shape>(folder: string, name: string) => designData<Shape>(folder, name, FILE);
const listOf = (folder: string, name: string, key: string) =>
  asList<Row>(data<Record<string, unknown>>(folder, name)?.[key]);

const toolsOf = (folder: string) => listOf(folder, "Tools", "tools");

function systemIsNamed(folder: string): boolean {
  const system = data<Row>(folder, "System");
  const named = isFilled(system?.name) && isFilled(system?.outcome) && isFilled(system?.owner);
  return named && wordCount(system?.whyAnAgent) >= 8;
}

function rungIsChosen(folder: string): boolean {
  const rung = data<Row>(folder, "System")?.rung;
  return typeof rung === "string" && RUNGS.includes(rung);
}

function toolIsDescribed(tool: Row): boolean {
  const filled = isFilled(tool.name) && ["read", "write"].includes(String(tool.action));
  const tiered = ["low", "medium", "high"].includes(String(tool.tier));
  return filled && tiered && typeof tool.reversible === "boolean";
}

const cannotUndo = (tool: Row) => tool.action === "write" && tool.reversible === false;

function everyIrreversibleHasGate(folder: string): boolean {
  const gates = listOf(folder, "Gates", "gates");
  const covered = gates.flatMap((gate) => asList<string>(gate.tools));
  const decidedByPerson = gates.every(
    (gate) => gate.onTimeout !== "proceed" && isFilled(gate.decides),
  );
  const tools = toolsOf(folder).filter(cannotUndo);
  return (
    gates.length > 0 &&
    decidedByPerson &&
    tools.every((tool) => covered.includes(String(tool.name)))
  );
}

function failureNamesOneCheck(row: Row): boolean {
  const caught = String(row.caughtBy ?? "");
  const vague = /monitor|dashboard|keep an eye|someone (will )?notice/i.test(caught);
  return /\bchecks?\b/i.test(caught) && !vague && wordCount(row.systemDoes) >= 5;
}

function costBeatsValue(folder: string): boolean {
  const cost = data<Row>(folder, "Cost");
  const spend = cost?.costPerOutcomeUsd;
  const value = cost?.valuePerOutcomeUsd;
  if (typeof spend !== "number" || typeof value !== "number") return false;
  return spend > 0 && spend < value && isFilled(cost?.whereTheNumbersCameFrom);
}

// Evidence is a file the learner made, such as a log. It must exist and not be empty.
function evidencePaths(folder: string): string[] {
  const files = listOf(folder, "Evidence", "files");
  return files.map((row) => String(row.path ?? ""));
}

const isRealFile = (folder: string, path: string) => {
  const full = join(folder, path);
  const inside = !path.startsWith("/") && !path.includes("..");
  return inside && existsSync(full) && statSync(full).isFile() && statSync(full).size > 0;
};

export default [
  {
    says: "my-system.md has six sections, each with a yaml design block",
    test: (folder) => {
      const text = readDesign(folder, FILE);
      const names = ["System", "Tools", "Gates", "Failures", "Cost", "Evidence"];
      return names.every((name) => block(text, name).ok);
    },
    tryNext:
      "copy the template and fill the yaml design block under each ## heading; " +
      "keep the fence line ```yaml design",
  },
  {
    says: "the system has a name, outcome, owner, rung and a reason for it",
    test: (folder) => systemIsNamed(folder) && rungIsChosen(folder),
    tryNext:
      "fill name, outcome, owner and why_an_agent (at least 8 words); " +
      `set rung to one of ${RUNGS.join(", ")}`,
  },
  {
    says: "at least two tools, each with a read or write action, reversible and a risk tier",
    test: (folder) => {
      const tools = toolsOf(folder);
      return tools.length >= FEWEST_TOOLS && tools.every(toolIsDescribed);
    },
    tryNext:
      "list at least two tools; give each name, action (read or write), " +
      "reversible (true or false) and tier (low, medium or high)",
  },
  {
    says: "every write that cannot be undone has a gate that never proceeds on timeout",
    test: everyIrreversibleHasGate,
    tryNext:
      "add a gate that lists the tool in tools:, names who decides, " +
      "and sets on_timeout to wait or escalate",
  },
  {
    says: "at least three failures, each caught by a check and each with a next step",
    test: (folder) => {
      const rows = listOf(folder, "Failures", "failures");
      return rows.length >= FEWEST_FAILURES && rows.every(failureNamesOneCheck);
    },
    tryNext:
      "write three failures; start each caught_by with a check that reads something, " +
      "and give system_does at least 5 words",
  },
  {
    says: "cost per outcome is below value per outcome, with a source",
    test: costBeatsValue,
    tryNext:
      "set cost_per_outcome_usd and value_per_outcome_usd as numbers, " +
      "and fill where_the_numbers_came_from with a real source from your work",
  },
  {
    says: "at least two evidence files exist next to my-system.md and are not empty",
    test: (folder) => {
      const paths = evidencePaths(folder);
      return paths.length >= FEWEST_EVIDENCE && paths.every((path) => isRealFile(folder, path));
    },
    tryNext:
      "put two real files from your own work in an evidence folder, such as a run log " +
      "and a screenshot, and list them under ## Evidence by path",
  },
] satisfies Rule[];
