// One way to call a model. Replay reads recorded replies, so the course runs with no key.
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { withSnakeCaseNames } from "../world/lib/field-names";
import {
  KEY_NAME,
  type LiveProvider,
  MODELS,
  type Provider,
  priceFor,
  provider,
  type Role,
} from "./models";

export type Usage = { input: number; cached: number; output: number };
export type Reply = { text: string; usage: Usage };
export type Call = { role: Role; system: string; prompt: string };
// Where to write the cost of a call, and why the call was made.
export type LedgerContext = { ledger: string; run: string; purpose: string };
export type Responder = (call: Call) => Promise<Reply> | Reply;

export const REPLAY_FILE = join(import.meta.dir, "..", "world", "replay", "storm-night.json");

type ReplayFile = { about: string; replies: Record<string, Reply> };
let replay: ReplayFile | undefined;

function loadReplay(): ReplayFile {
  if (replay) return replay;
  if (!existsSync(REPLAY_FILE)) {
    throw new Error(
      "No replay file at world/replay/storm-night.json. Run git checkout world/replay.",
    );
  }
  replay = JSON.parse(readFileSync(REPLAY_FILE, "utf8")) as ReplayFile;
  return replay;
}

// The replay key of a call: a short fingerprint of its role, instructions and prompt.
// Change one word of a prompt and the key changes, so replay can no longer find the reply.
export function replayKeyOf(call: Call): string {
  const fingerprint = createHash("sha256").update(`${call.role}\n${call.system}\n${call.prompt}`);
  return fingerprint.digest("hex").slice(0, 20);
}

// Used only when building or re-recording the replay file.
let responder: Responder | undefined;
let recording: ReplayFile | undefined;

export function startRecording(about: string, answer?: Responder) {
  recording = { about, replies: {} };
  responder = answer;
}

export function saveRecording(path = REPLAY_FILE) {
  if (!recording) throw new Error("not recording");
  writeFileSync(path, `${JSON.stringify(recording)}\n`);
  replay = recording;
  recording = undefined;
  responder = undefined;
}

function liveModel(liveProvider: LiveProvider, role: Role) {
  const apiKey = process.env[KEY_NAME[liveProvider]];
  if (!apiKey) {
    const keyName = KEY_NAME[liveProvider];
    throw new Error(`LLM_PROVIDER is ${liveProvider} but ${keyName} is empty. Put it in .env.`);
  }
  const modelId = MODELS[liveProvider][role];
  if (liveProvider === "anthropic") return createAnthropic({ apiKey })(modelId);
  if (liveProvider === "openai") return createOpenAI({ apiKey })(modelId);
  return createOpenRouter({ apiKey })(modelId);
}

// The cost of one call in US dollars, or null when the price is not known.
export function costOf(
  role: Role,
  usage: Usage,
  chosenProvider: Provider = provider(),
): number | null {
  const price = priceFor(chosenProvider, role);
  if (!price) return null;
  const freshInput = usage.input - usage.cached;
  const inputCost = freshInput * price.input + usage.cached * price.cachedInput;
  return (inputCost + usage.output * price.output) / 1e6;
}

function replayedReply(call: Call): Reply {
  const reply = loadReplay().replies[replayKeyOf(call)];
  if (!reply) {
    throw new Error(
      `No recorded reply for this ${call.role} call. ` +
        "The prompt changed; set LLM_PROVIDER and a key to run it live.",
    );
  }
  return reply;
}

async function liveReply(call: Call, liveProvider: LiveProvider): Promise<Reply> {
  const model = liveModel(liveProvider, call.role);
  const result = await generateText({ model, system: call.system, prompt: call.prompt });
  const usage = {
    input: result.usage.inputTokens ?? 0,
    cached: result.usage.inputTokenDetails?.cacheReadTokens ?? 0,
    output: result.usage.outputTokens ?? 0,
  };
  return { text: result.text, usage };
}

function writeToLedger(call: Call, reply: Reply, chosenProvider: Provider, context: LedgerContext) {
  const costUsd = costOf(call.role, reply.usage, chosenProvider);
  const { run, purpose } = context;
  const entry = {
    run,
    purpose,
    role: call.role,
    provider: chosenProvider,
    ...reply.usage,
    costUsd,
  };
  appendFileSync(context.ledger, `${JSON.stringify(withSnakeCaseNames(entry))}\n`);
}

// Ask a model. Without a key this plays back the recorded reply.
export async function ask(call: Call, context?: LedgerContext): Promise<Reply> {
  const chosenProvider = provider();
  let reply: Reply;
  if (responder) reply = await responder(call);
  else if (chosenProvider === "replay") reply = replayedReply(call);
  else reply = await liveReply(call, chosenProvider);

  if (recording) recording.replies[replayKeyOf(call)] = reply;
  if (context) writeToLedger(call, reply, chosenProvider, context);
  return reply;
}
