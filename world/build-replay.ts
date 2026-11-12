// Builds world/replay/storm-night.json, the replies that replay mode plays back.
//   bun world/build-replay.ts
// No key was available when this course was built, so these replies come from a scripted stand-in for the
// model, not from a live model: it reads each prompt the sample design sends and answers in the same JSON a
// model must return. It makes planted mistakes a real model makes (it misreads a street now and then, and it
// tries to close an outage on the crew's word without reading the meters). Token counts are estimated from
// the text length. To replace it with a real recording, run the storm with a key and save the replies.
import { startRecording, saveRecording, type Call, type Reply } from "../config/llm";
import { runStorm } from "../finished/harness";
import { CREW, EXTRACT, UPDATE } from "../finished/prompts";
import { seed } from "./lib/oms";
import { unit } from "./lib/rng";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tokens = (s: string) => Math.ceil(s.length / 4);
const usage = (c: Call, text: string, padding = 0) => {
  const sys = tokens(c.system) + padding;
  return { input: sys + tokens(c.prompt), cached: sys, output: tokens(text) };
};

const streets = [...new Set(seed.customers().map((c) => c.street))];
const lower = new Map(streets.map((s) => [s.toLowerCase(), s]));

function extract(c: Call): Reply {
  const m = c.prompt.match(/^Report (\S+) via (\w+): (.*)$/s)!;
  const [, id, , body] = m;
  const account = body.match(/\bC\d{5}\b/)?.[0] ?? null;
  let street: string | null = null;
  for (const s of streets) if (body.toLowerCase().includes(s.toLowerCase())) street = s;
  const num = body.match(/(?:^|\s|no )(\d{1,3})\s+[A-Za-z]/i)?.[1] ?? body.match(/number (\d{1,3})/)?.[1] ?? null;
  const notOutage = /power is on|power back|rest of the house works|false alarm/i.test(body);
  // Planted misreads: about 2 in 100 reports get a sibling street with the same first word.
  if (street && unit(id) < 0.02) {
    const first = street.split(" ")[0];
    const sib = streets.filter((s) => s !== street && s.startsWith(first + " "));
    if (sib.length) street = sib[Math.floor(unit(id + "s") * sib.length)];
  }
  const text = JSON.stringify({ account: unit(id + "a") < 0.02 ? null : account, number: num ? Number(num) : null, street: street ? lower.get(street.toLowerCase())! : null, kind: notOutage ? "not-outage" : "outage" });
  return { text, usage: usage(c, text) };
}

function update(c: Call): Reply {
  const minutes = c.prompt.match(/in about (-?\d+) minutes/)?.[1] ?? "?";
  const text = `Copperbeck Power: we know about the power cut on your street. A crew is on the way. We expect power back in about ${minutes} minutes.`;
  return { text, usage: usage(c, text) };
}

// The crew agent carries a long context: its instructions, the network summary and the turn history.
const AGENT_CONTEXT_TOKENS = 6000;
function crew(c: Call): Reply {
  const s = JSON.parse(c.prompt);
  let reply: Record<string, unknown>;
  if (s.ask === "assign") {
    const rank = (o: any) => [o.critical.length ? 0 : 1, -o.customers, o.opened_at];
    const sorted = [...s.waiting].sort((a: any, b: any) => {
      const ra = rank(a), rb = rank(b);
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
      return 0;
    });
    const o = sorted[0];
    const etr = o.kind === "recloser" ? 200 : 100 + Math.round(unit(o.outage) * 4) * 10;
    reply = { tool: "crew_assign", outage: o.outage, crew: s.free_crews[0], etr_minutes: etr };
  } else if (s.ask === "notify") {
    reply = { tool: "notify_customers", outage: s.outage, include_critical: true };
  } else {
    // Planted mistake: the agent takes the crew's word and closes without reading the meters.
    reply = { tool: "oms_close_outage", outage: s.outage };
  }
  const text = JSON.stringify(reply);
  return { text, usage: usage(c, text, AGENT_CONTEXT_TOKENS) };
}

startRecording(
  "Scripted stand-in replies for the sample design, built by world/build-replay.ts. Not a live model recording.",
  (c) => (c.system === EXTRACT ? extract(c) : c.system === UPDATE ? update(c) : c.system === CREW ? crew(c) : { text: "", usage: { input: 0, cached: 0, output: 0 } }),
);
const dir = join(tmpdir(), `copperbeck-build-${Date.now()}`);
const res = await runStorm(dir);
saveRecording();
console.log(`Replay saved. The run ended at minute ${res.endedAt}.`);
