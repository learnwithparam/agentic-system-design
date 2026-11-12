// bun run models: one tiny call per role on the chosen provider.
// It prints the provider, each role, pass or fail, and the cost.
// It never prints a key or a model id.
import { existsSync, readFileSync } from "node:fs";
import { ask, costOf, REPLAY_FILE } from "../config/llm";
import { type Provider, provider, ROLES, type Role } from "../config/models";

// Replay has no live model. A role passes when the recorded replies load.
function checkReplay(role: Role): boolean {
  let found = false;
  if (existsSync(REPLAY_FILE)) {
    const replay = JSON.parse(readFileSync(REPLAY_FILE, "utf8"));
    found = Object.keys(replay.replies ?? {}).length > 0;
  }
  const result = found ? "PASS" : "FAIL";
  const replies = found ? "found" : "missing";
  console.log(`  ${role.padEnd(6)} ${result}  recorded replies ${replies}, cost $0.0000`);
  return found;
}

async function checkLiveRole(role: Role, chosenProvider: Provider): Promise<boolean> {
  try {
    const call = { role, system: "Reply with the single word: ready", prompt: "Are you ready?" };
    const reply = await ask(call);
    const cost = costOf(role, reply.usage, chosenProvider);
    const answered = /ready/i.test(reply.text);
    const shownCost = cost === null ? "unknown" : `$${cost.toFixed(6)}`;
    const tokens = `${reply.usage.input} in, ${reply.usage.output} out`;
    console.log(`  ${role.padEnd(6)} ${answered ? "PASS" : "FAIL"}  ${tokens}, cost ${shownCost}`);
    return answered;
  } catch (error) {
    const firstLine = (error as Error).message.split("\n")[0];
    console.log(`  ${role.padEnd(6)} FAIL  ${firstLine}`);
    return false;
  }
}

let chosenProvider: Provider;
try {
  chosenProvider = provider();
} catch (error) {
  console.log((error as Error).message);
  process.exit(1);
}
console.log(`Provider: ${chosenProvider}`);

let failed = 0;
for (const role of ROLES) {
  let passed: boolean;
  if (chosenProvider === "replay") passed = checkReplay(role);
  else passed = await checkLiveRole(role, chosenProvider);
  if (!passed) failed++;
}
if (failed) console.log(`${failed} role(s) failed. See 00-orientation/troubleshooting.md.`);
else console.log("Every role answers.");
process.exit(failed ? 1 : 0);
