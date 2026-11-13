import type { Rule } from "../scripts/verify";
import { asList, block, designData, isFilled, readDesign } from "./lib/design";
import { readDesk } from "./lib/world";
import { toolsOf } from "./scope-the-tools";

// One gate in the Gates block. A learner may leave any field out, so every field is optional.
type Gate = {
  gate?: unknown;
  tools?: unknown;
  trigger?: unknown;
  decides?: unknown;
  answers?: unknown;
  deadlineMinutes?: unknown;
  onTimeout?: unknown;
  per?: unknown;
  count?: unknown;
};
type Gates = { limitPerShift?: unknown; gates?: unknown };

// The four ways a person can answer a gate, from HumanLayer's Agent Inbox.
export const ANSWERS = ["accept", "edit", "respond", "ignore"];
// What happens when nobody answers in time. "proceed" is never on the list.
export const TIMEOUT_ACTIONS = ["wait", "escalate", "cancel"];
// What a gate fires on. Each one has a count per month in world/desk.yaml.
export const GATE_EVENTS: Record<string, string> = {
  outage: "outages",
  report: "reports",
  "critical-call": "criticalCalls",
};
const MACHINES = ["agent", "model", "system", "code", "harness", "none", "nobody"];
// A person needs at least two minutes to read one gate and decide.
const MINUTES_TO_READ_ONE_GATE = 2;
const MINUTES_IN_A_MONTH = 30 * 24 * 60;

const gatesBlock = (folder: string) => designData<Gates>(folder, "Gates") ?? {};
const gatesOf = (folder: string) => asList<Gate>(gatesBlock(folder).gates);
const toolsGated = (gate: Gate) => asList<unknown>(gate.tools).map(String);

function hasEveryField(gate: Gate, toolNames: string[]): boolean {
  const tools = toolsGated(gate);
  const answers = asList<unknown>(gate.answers).map(String);
  const deadline = gate.deadlineMinutes;
  const decidedByPerson = isFilled(gate.decides) && !MACHINES.includes(String(gate.decides));
  return (
    isFilled(gate.gate) &&
    tools.length > 0 &&
    tools.every((tool) => toolNames.includes(tool)) &&
    isFilled(gate.trigger) &&
    decidedByPerson &&
    answers.length > 0 &&
    answers.every((answer) => ANSWERS.includes(answer)) &&
    typeof deadline === "number" &&
    deadline > 0 &&
    String(gate.per) in GATE_EVENTS &&
    typeof gate.count === "number"
  );
}

// How many gates one desk lead sees in one shift of a storm month,
// with one desk lead on duty at a time.
export async function gatesPerShift(gates: Gate[]): Promise<number> {
  const { volumes } = await readDesk();
  const stormMonth = volumes.stormMonth;
  const shiftsPerMonth = MINUTES_IN_A_MONTH / volumes.deskLeadShiftMinutes;
  let gatesPerMonth = 0;
  for (const gate of gates) {
    const eventsPerMonth = stormMonth[GATE_EVENTS[String(gate.per)]] ?? 0;
    gatesPerMonth += eventsPerMonth * (Number(gate.count) || 0);
  }
  return gatesPerMonth / shiftsPerMonth;
}

async function staysUnderTheLimit(folder: string): Promise<boolean> {
  const limit = gatesBlock(folder).limitPerShift;
  const { volumes } = await readDesk();
  const mostOnePersonCanRead = volumes.deskLeadShiftMinutes / MINUTES_TO_READ_ONE_GATE;
  if (typeof limit !== "number" || limit <= 0 || limit > mostOnePersonCanRead) return false;
  const gates = gatesOf(folder);
  return gates.length > 0 && (await gatesPerShift(gates)) <= limit;
}

async function coversCriticalCustomers(folder: string): Promise<boolean> {
  const { hardRules } = await readDesk();
  const criticalRule = hardRules.find((rule) => rule.id === "P3");
  const keywords = criticalRule?.keywords ?? [];
  const mentionsCritical = (gate: Gate) =>
    keywords.every((keyword) => new RegExp(keyword, "i").test(String(gate.trigger)));
  return gatesOf(folder).some(mentionsCritical);
}

export default [
  {
    says: "design.md has a Gates section with a yaml design block, after a Tools section",
    test: (folder) => {
      const design = readDesign(folder);
      return block(design, "Tools").ok && block(design, "Gates").ok;
    },
    tryNext: "keep your Tools section and fill the yaml design block under ## Gates",
  },
  {
    says: "every gate names its tools, trigger, the person who decides, answers and deadline",
    test: (folder) => {
      const toolNames = toolsOf(folder).map((tool) => String(tool.name));
      const gates = gatesOf(folder);
      return gates.length > 0 && gates.every((gate) => hasEveryField(gate, toolNames));
    },
    tryNext:
      "give each gate tools: from your Tools section, a trigger:, decides: (a person " +
      "such as desk-lead), answers: from accept, edit, respond, ignore, deadline_minutes:, " +
      "per: (outage, report or critical-call) and count:",
  },
  {
    says: "every tier-high tool has a gate",
    test: (folder) => {
      const gated = gatesOf(folder).flatMap(toolsGated);
      const highTools = toolsOf(folder).filter((tool) => tool.tier === "high");
      return highTools.every((tool) => gated.includes(String(tool.name)));
    },
    tryNext: "add each tool with tier: high in your Tools section to a gate's tools: list",
  },
  {
    says: "no gate proceeds on timeout; each waits, escalates or cancels",
    test: (folder) => {
      const gates = gatesOf(folder);
      return (
        gates.length > 0 && gates.every((gate) => TIMEOUT_ACTIONS.includes(String(gate.onTimeout)))
      );
    },
    tryNext:
      "a gate that goes ahead when nobody answers is not a gate; " +
      "set on_timeout: to wait, escalate or cancel",
  },
  {
    says: "gates per desk lead per shift in a storm month stay under your limit",
    test: staysUnderTheLimit,
    tryNext:
      "set limit_per_shift: (at most 240, two minutes a gate) and gate per outage, " +
      "not per report; a storm month has 16000 reports but only 420 outages",
  },
  {
    says: "a gate covers rule P3: a person tells each critical customer the restore time",
    test: coversCriticalCustomers,
    tryNext:
      "add a gate whose trigger: names critical customers, " +
      "such as a hospital or care home behind the outage",
  },
] satisfies Rule[];
