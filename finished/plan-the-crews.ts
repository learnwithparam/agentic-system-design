// plan-the-crews: an agent. The model picks the next step.
// Code runs the tool and enforces the rules.
import { ask } from "../config/llm";
import { withCamelCaseNames, withSnakeCaseNames } from "../world/lib/field-names";
import { parseJsonReply } from "./group-the-reports";
import { CREW } from "./prompts";
import {
  allOutages,
  clock,
  customersBehind,
  darkMetersBehind,
  type Outage,
  openOutage,
  openOutageOn,
  recordEvent,
  type Storm,
} from "./storm-state";
import { writeTheCustomerUpdates } from "./write-the-customer-updates";

// The one tool call the agent answers with, such as { tool: "crew_assign", outage: "OUT-001" }.
type ToolCall = {
  tool?: string;
  outage?: string;
  crew?: string;
  etrMinutes?: number;
  includeCritical?: boolean;
};

type FreeCrew = { id: string; depot: string };

// One turn of the agent. The situation goes out as JSON with snake_case names, as the prompt says.
async function agentTurn(storm: Storm, situation: Record<string, unknown>): Promise<ToolCall> {
  const prompt = JSON.stringify(withSnakeCaseNames(situation));
  const context = { ledger: storm.files.ledger, run: storm.run, purpose: "plan-the-crews" };
  const reply = await ask({ role: "smart", system: CREW, prompt }, context);
  const toolCall = parseJsonReply<unknown>(reply.text, { tool: "none" });
  return withCamelCaseNames<ToolCall>(toolCall);
}

// P2: never close an outage while meters behind its device are dark.
// Returns true when the close was blocked. Each dark branch then gets an outage of its own.
function blockCloseWhileDark(storm: Storm, outage: Outage): boolean {
  const dark = darkMetersBehind(storm, outage.device);
  if (dark.length === 0) return false;
  const result = `${dark.length} smart meters behind ${outage.device} still dark`;
  const args = { outage: outage.id };
  recordEvent(storm, {
    at: storm.now,
    kind: "blocked",
    rule: "P2",
    tool: "oms_close_outage",
    by: "agent",
    args,
    result,
  });
  const where = `${dark.length} meters behind ${outage.device}`;
  storm.log(`  ${clock(storm.now)}  BLOCKED close of ${outage.id}: ${where} still dark`);
  const darkDevices = [...new Set(dark.map((customer) => customer.device))];
  for (const device of darkDevices) {
    if (!openOutageOn(storm, device)) {
      openOutage(storm, device, "meters still dark after the repair above it");
    }
  }
  return true;
}

// The crew says the repair is done. The agent decides whether to close the outage.
export async function tryToClose(storm: Storm, outage: Outage) {
  const toolCall = await agentTurn(storm, {
    ask: "crew_done",
    now: storm.now,
    outage: outage.id,
    device: outage.device,
    crew: outage.crew,
    crewSays: "repair done, power restored",
  });
  const args = { outage: outage.id };
  if (toolCall.tool === "oms_read_meters") {
    const result = `${darkMetersBehind(storm, outage.device).length} dark`;
    recordEvent(storm, {
      at: storm.now,
      kind: "tool",
      tool: "oms_read_meters",
      by: "agent",
      args,
      result,
    });
  }
  if (toolCall.tool !== "oms_close_outage" && toolCall.tool !== "oms_read_meters") return;
  if (blockCloseWhileDark(storm, outage)) return;
  const sql = "UPDATE outages SET status = 'closed', closed_at = ? WHERE id = ?";
  storm.db.run(sql, [storm.now, outage.id]);
  const result = "closed";
  recordEvent(storm, {
    at: storm.now,
    kind: "tool",
    tool: "oms_close_outage",
    by: "agent",
    args,
    result,
  });
}

function describeWaitingOutage(storm: Storm, outage: Outage) {
  const behind = customersBehind(storm, outage.device);
  const critical = behind.filter((customer) => customer.critical);
  return {
    outage: outage.id,
    device: outage.device,
    kind: outage.device.startsWith("R-") ? "recloser" : "fuse",
    customers: behind.length,
    critical: critical.map((customer) => customer.critical),
    openedAt: outage.openedAt,
  };
}

// Send the crew, book its time, and tell the customers.
async function assignCrew(storm: Storm, outage: Outage, toolCall: ToolCall) {
  const crew = toolCall.crew as string;
  const key = `${outage.id}:${crew}`;
  storm.assignmentKeys.add(key);
  const failure = storm.failureOn.get(outage.device);
  const workMinutes = failure ? failure.travelMinutes + failure.repairMinutes : 30;
  const etr = storm.now + Number(toolCall.etrMinutes);
  const assign =
    "UPDATE outages SET status = 'assigned', crew = ?, assigned_at = ?, etr = ? WHERE id = ?";
  storm.db.run(assign, [crew, storm.now, etr, outage.id]);
  storm.db.run("UPDATE crews SET free_at = ? WHERE id = ?", [storm.now + workMinutes, crew]);
  storm.crewDoneAt.set(outage.id, storm.now + workMinutes);
  recordEvent(storm, {
    at: storm.now,
    kind: "tool",
    tool: "crew_assign",
    by: "agent",
    args: { outage: outage.id, crew, etrMinutes: toolCall.etrMinutes, idempotencyKey: key },
    result: "assigned",
  });
  const restoreIn = `restore in about ${toolCall.etrMinutes} min`;
  storm.log(`  ${clock(storm.now)}  ${crew} to ${outage.id} on ${outage.device}, ${restoreIn}`);

  const criticalCount = customersBehind(storm, outage.device).filter((row) => row.critical).length;
  const notify = await agentTurn(storm, {
    ask: "notify",
    now: storm.now,
    outage: outage.id,
    etrMinutes: toolCall.etrMinutes,
    critical: criticalCount,
  });
  if (notify.tool !== "notify_customers") return;
  const assigned = { ...outage, etr, crew };
  await writeTheCustomerUpdates(storm, assigned, Boolean(notify.includeCritical));
}

// Ask the agent for one assignment. Returns false when there is nothing more to assign this tick.
async function assignOneCrew(storm: Storm): Promise<boolean> {
  const crewQuery = "SELECT id, depot FROM crews WHERE free_at <= ? ORDER BY id";
  const freeCrews = storm.db.query(crewQuery).all(storm.now) as FreeCrew[];
  const waiting = allOutages(storm).filter((outage) => outage.status === "waiting");
  if (!freeCrews.length || !waiting.length) return false;

  const toolCall = await agentTurn(storm, {
    ask: "assign",
    now: storm.now,
    freeCrews: freeCrews.map((crew) => crew.id),
    waiting: waiting.map((outage) => describeWaitingOutage(storm, outage)),
  });
  const outage = waiting.find((candidate) => candidate.id === toolCall.outage);
  const crewIsFree = freeCrews.some((crew) => crew.id === toolCall.crew);
  if (toolCall.tool !== "crew_assign" || !outage || !crewIsFree) {
    const result = "bad tool call, retry next tick";
    recordEvent(storm, { at: storm.now, kind: "error", tool: toolCall.tool, by: "agent", result });
    return false;
  }
  // The idempotency key stops the same crew being sent to the same outage twice.
  if (storm.assignmentKeys.has(`${outage.id}:${toolCall.crew}`)) return false;
  await assignCrew(storm, outage, toolCall);
  return true;
}

// Send free crews to waiting outages until no crew is free or no outage waits.
export async function planTheCrews(storm: Storm) {
  let assigned = true;
  while (assigned) assigned = await assignOneCrew(storm);
}
