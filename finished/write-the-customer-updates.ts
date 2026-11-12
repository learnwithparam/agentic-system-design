// write-the-customer-updates: one model call per outage writes the text message.
// Critical customers never get a text from the machine. Rule P3 sends them to a person.
import { ask } from "../config/llm";
import { stableFraction } from "../world/lib/random";
import { UPDATE } from "./prompts";
import { clock, customersBehind, type Outage, recordEvent, type Storm } from "./storm-state";

// P3: a critical customer hears the restore time from a person.
// The gate routes the call to the desk lead.
function routeCriticalCustomers(storm: Storm, outage: Outage) {
  const critical = customersBehind(storm, outage.device).filter((customer) => customer.critical);
  for (const customer of critical) {
    // The desk lead answers in 6 to 12 minutes.
    // The same outage and customer always give the same time.
    const answerIn = 6 + Math.floor(stableFraction(`${outage.id}${customer.id}`) * 7);
    recordEvent(storm, {
      at: storm.now,
      kind: "gate",
      tool: "call_critical_customer",
      by: "agent",
      args: { outage: outage.id, customer: customer.id },
      result: `routed to desk lead, answered in ${answerIn} min`,
    });
    const callAt = storm.now + answerIn;
    const sql = "INSERT INTO calls VALUES (?, ?, ?, ?, ?)";
    storm.db.run(sql, [outage.id, customer.id, callAt, "person:desk-lead", outage.etr]);
    const calledAt = clock(callAt).trim();
    storm.log(
      `  ${clock(storm.now)}  ${customer.name} routed to the desk lead, who calls at ${calledAt}`,
    );
  }
}

// Text every customer behind the outage its restore time, then route the critical ones to a person.
export async function writeTheCustomerUpdates(
  storm: Storm,
  outage: Outage,
  includeCritical: boolean,
) {
  const affected = customersBehind(storm, outage.device);
  const criticalCount = affected.filter((customer) => customer.critical).length;
  const textCount = affected.length - criticalCount;
  const minutes = (outage.etr ?? storm.now) - storm.now;
  const streets = [...new Set(affected.map((customer) => customer.street))].join(", ");
  const prompt =
    `Outage ${outage.id}: ${textCount} customers on ${streets}. ` +
    `Restore time: in about ${minutes} minutes.`;
  const purpose = "write-the-customer-updates";
  const context = { ledger: storm.files.ledger, run: storm.run, purpose };
  const message = await ask({ role: "fast", system: UPDATE, prompt }, context);

  const sql = "INSERT INTO notices VALUES (?, ?, ?, ?)";
  storm.db.run(sql, [outage.id, storm.now, textCount, message.text]);
  recordEvent(storm, {
    at: storm.now,
    kind: "tool",
    tool: "notify_customers",
    by: "agent",
    args: { outage: outage.id, includeCritical },
    result: `${textCount} texts`,
  });
  routeCriticalCustomers(storm, outage);
}
