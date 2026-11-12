// One way to call a model. Replay reads recorded replies, so the course runs with no key.
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { KEY_NAME, MODELS, priceFor, provider, type Provider, type Role } from "./models";

export type Usage = { input: number; cached: number; output: number };
export type Reply = { text: string; usage: Usage };
export type Call = { role: Role; system: string; prompt: string };
export type LedgerContext = { ledger: string; run: string; purpose: string };

export const REPLAY_FILE = join(import.meta.dir, "..", "world", "replay", "storm-night.json");

type ReplayFile = { about: string; replies: Record<string, Reply> };
let replay: ReplayFile | undefined;
const loadReplay = (): ReplayFile => {
  if (!replay) {
    if (!existsSync(REPLAY_FILE)) throw new Error(`No replay file at world/replay/storm-night.json. Run git checkout world/replay.`);
    replay = JSON.parse(readFileSync(REPLAY_FILE, "utf8")) as ReplayFile;
  }
  return replay;
};

export const keyOf = (c: Call) => createHash("sha256").update(`${c.role}\n${c.system}\n${c.prompt}`).digest("hex").slice(0, 20);

// Used only when building or re-recording the replay file.
let responder: ((c: Call) => Promise<Reply> | Reply) | undefined;
let recording: ReplayFile | undefined;
export function startRecording(about: string, answer?: (c: Call) => Promise<Reply> | Reply) {
  recording = { about, replies: {} };
  responder = answer;
}
export function saveRecording(path = REPLAY_FILE) {
  if (!recording) throw new Error("not recording");
  writeFileSync(path, JSON.stringify(recording) + "\n");
  replay = recording;
  recording = undefined;
  responder = undefined;
}

function liveModel(p: Exclude<Provider, "replay">, role: Role) {
  const key = process.env[KEY_NAME[p]];
  if (!key) throw new Error(`LLM_PROVIDER is ${p} but ${KEY_NAME[p]} is empty. Put it in .env.`);
  const id = MODELS[p][role];
  if (p === "anthropic") return createAnthropic({ apiKey: key })(id);
  if (p === "openai") return createOpenAI({ apiKey: key })(id);
  return createOpenRouter({ apiKey: key })(id);
}

export function costOf(role: Role, u: Usage, p: Provider = provider()): number | null {
  const price = priceFor(p, role);
  if (!price) return null;
  return ((u.input - u.cached) * price.input + u.cached * price.cachedInput + u.output * price.output) / 1e6;
}

export async function ask(c: Call, ctx?: LedgerContext): Promise<Reply> {
  const p = provider();
  let reply: Reply;
  if (responder) reply = await responder(c);
  else if (p === "replay") {
    const r = loadReplay().replies[keyOf(c)];
    if (!r) throw new Error(`No recorded reply for this ${c.role} call. The prompt changed; set LLM_PROVIDER and a key to run it live.`);
    reply = r;
  } else {
    const res = await generateText({ model: liveModel(p, c.role), system: c.system, prompt: c.prompt });
    const u = res.usage;
    reply = {
      text: res.text,
      usage: { input: u.inputTokens ?? 0, cached: u.inputTokenDetails?.cacheReadTokens ?? 0, output: u.outputTokens ?? 0 },
    };
  }
  if (recording) recording.replies[keyOf(c)] = reply;
  if (ctx) {
    const cost = costOf(c.role, reply.usage, p);
    appendFileSync(ctx.ledger, JSON.stringify({ run: ctx.run, purpose: ctx.purpose, role: c.role, provider: p, ...reply.usage, cost_usd: cost }) + "\n");
  }
  return reply;
}
