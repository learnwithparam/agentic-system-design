// Builds world/replay/storm-night.json, the replies that replay mode plays back.
//   bun world/build-replay.ts
// No key was available when this course was built, so these replies come from a scripted stand-in
// for the model, not from a live model. It reads each prompt the sample design sends and answers in
// the same JSON a model must return. It makes planted mistakes a real model makes: it misreads a
// street now and then, and it tries to close an outage on the crew's word
// without reading the meters.
// Token counts are estimated from the text length. To replace it with a real recording,
// run the storm with a key and save the replies.
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Call, type Reply, saveRecording, startRecording } from "../config/llm";
import { runStorm } from "../finished/harness";
import { CREW, EXTRACT, UPDATE } from "../finished/prompts";
import { withCamelCaseNames, withSnakeCaseNames } from "./lib/field-names";
import { seed } from "./lib/oms";
import { stableFraction } from "./lib/random";

// About four characters of English make one token.
const tokensIn = (text: string) => Math.ceil(text.length / 4);

function usageOf(call: Call, replyText: string, extraContextTokens = 0) {
  const systemTokens = tokensIn(call.system) + extraContextTokens;
  return {
    input: systemTokens + tokensIn(call.prompt),
    cached: systemTokens,
    output: tokensIn(replyText),
  };
}

const streets = [...new Set(seed.customers().map((customer) => customer.street))];

function houseNumberIn(body: string): string | null {
  const beforeStreet = body.match(/(?:^|\s|no )(\d{1,3})\s+[A-Za-z]/i)?.[1];
  if (beforeStreet) return beforeStreet;
  return body.match(/number (\d{1,3})/)?.[1] ?? null;
}

// Planted misread: about 2 in 100 reports get a sibling street with the same first word,
// such as Elm Lane for Elm Road.
function maybeMisreadStreet(reportId: string, street: string): string {
  if (stableFraction(reportId) >= 0.02) return street;
  const firstWord = street.split(" ")[0];
  const siblings = streets.filter((other) => other !== street && other.startsWith(`${firstWord} `));
  if (!siblings.length) return street;
  return siblings[Math.floor(stableFraction(`${reportId}s`) * siblings.length)];
}

function extract(call: Call): Reply {
  const [, reportId, , body] = call.prompt.match(/^Report (\S+) via (\w+): (.*)$/s) as string[];
  const account = body.match(/\bC\d{5}\b/)?.[0] ?? null;
  let street: string | null = null;
  for (const candidate of streets) {
    if (body.toLowerCase().includes(candidate.toLowerCase())) street = candidate;
  }
  if (street) street = maybeMisreadStreet(reportId, street);
  const houseNumber = houseNumberIn(body);
  const notOutage = /power is on|power back|rest of the house works|false alarm/i.test(body);
  // Planted miss: about 2 in 100 reports lose their account number.
  const dropAccount = stableFraction(`${reportId}a`) < 0.02;
  const text = JSON.stringify({
    account: dropAccount ? null : account,
    number: houseNumber ? Number(houseNumber) : null,
    street,
    kind: notOutage ? "not-outage" : "outage",
  });
  return { text, usage: usageOf(call, text) };
}

function update(call: Call): Reply {
  const minutes = call.prompt.match(/in about (-?\d+) minutes/)?.[1] ?? "?";
  const text =
    "Copperbeck Power: we know about the power cut on your street. A crew is on the way. " +
    `We expect power back in about ${minutes} minutes.`;
  return { text, usage: usageOf(call, text) };
}

type WaitingOutage = {
  outage: string;
  kind: string;
  customers: number;
  critical: string[];
  openedAt: number;
};
type Situation = { ask: string; outage: string; freeCrews: string[]; waiting: WaitingOutage[] };

// Critical customers first, then the most customers, then the oldest outage.
function mostUrgentFirst(first: WaitingOutage, second: WaitingOutage): number {
  const firstHasCritical = first.critical.length ? 0 : 1;
  const secondHasCritical = second.critical.length ? 0 : 1;
  if (firstHasCritical !== secondHasCritical) return firstHasCritical - secondHasCritical;
  if (first.customers !== second.customers) return second.customers - first.customers;
  return first.openedAt - second.openedAt;
}

function chooseAssignment(situation: Situation) {
  const outage = [...situation.waiting].sort(mostUrgentFirst)[0];
  let etrMinutes = 200;
  if (outage.kind !== "recloser") {
    etrMinutes = 100 + Math.round(stableFraction(outage.outage) * 4) * 10;
  }
  return { tool: "crew_assign", outage: outage.outage, crew: situation.freeCrews[0], etrMinutes };
}

// The crew agent carries a long context:
// its instructions, the network summary and the turn history.
const AGENT_CONTEXT_TOKENS = 6000;

function crew(call: Call): Reply {
  const situation = withCamelCaseNames<Situation>(JSON.parse(call.prompt));
  let reply: Record<string, unknown>;
  if (situation.ask === "assign") reply = chooseAssignment(situation);
  else if (situation.ask === "notify") {
    reply = { tool: "notify_customers", outage: situation.outage, includeCritical: true };
  } else {
    // Planted mistake: the agent takes the crew's word and closes without reading the meters.
    reply = { tool: "oms_close_outage", outage: situation.outage };
  }
  const text = JSON.stringify(withSnakeCaseNames(reply));
  return { text, usage: usageOf(call, text, AGENT_CONTEXT_TOKENS) };
}

function scriptedModel(call: Call): Reply {
  if (call.system === EXTRACT) return extract(call);
  if (call.system === UPDATE) return update(call);
  if (call.system === CREW) return crew(call);
  return { text: "", usage: { input: 0, cached: 0, output: 0 } };
}

const about =
  "Scripted stand-in replies for the sample design, built by world/build-replay.ts. " +
  "Not a live model recording.";
startRecording(about, scriptedModel);
const result = await runStorm(join(tmpdir(), `copperbeck-build-${Date.now()}`));
saveRecording();
console.log(`Replay saved. The run ended at minute ${result.endedAt}.`);
