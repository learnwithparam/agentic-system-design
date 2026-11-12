// bun run models: one tiny call per role on the chosen provider. Prints provider, role, pass or fail and cost.
// It never prints a key or a model id.
import { ask, costOf, REPLAY_FILE } from "../config/llm";
import { provider, ROLES } from "../config/models";
import { existsSync, readFileSync } from "node:fs";

let p;
try { p = provider(); } catch (e) { console.log((e as Error).message); process.exit(1); }
console.log(`Provider: ${p}`);
let failed = 0;
for (const role of ROLES) {
  if (p === "replay") {
    // Replay has no live model. It passes when the recorded replies load.
    const ok = existsSync(REPLAY_FILE) && Object.keys(JSON.parse(readFileSync(REPLAY_FILE, "utf8")).replies ?? {}).length > 0;
    console.log(`  ${role.padEnd(6)} ${ok ? "PASS" : "FAIL"}  recorded replies ${ok ? "found" : "missing"}, cost $0.0000`);
    if (!ok) failed++;
    continue;
  }
  try {
    const r = await ask({ role, system: "Reply with the single word: ready", prompt: "Are you ready?" });
    const cost = costOf(role, r.usage, p);
    const ok = /ready/i.test(r.text);
    console.log(`  ${role.padEnd(6)} ${ok ? "PASS" : "FAIL"}  ${r.usage.input} in, ${r.usage.output} out, cost ${cost === null ? "unknown" : `$${cost.toFixed(6)}`}`);
    if (!ok) failed++;
  } catch (e) {
    console.log(`  ${role.padEnd(6)} FAIL  ${(e as Error).message.split("\n")[0]}`);
    failed++;
  }
}
console.log(failed ? `${failed} role(s) failed. See 00-orientation/troubleshooting.md.` : "Every role answers.");
process.exit(failed ? 1 : 0);
