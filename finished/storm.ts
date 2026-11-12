// bun run storm            replay the sample design through the storm night, then print the board
// bun run storm --quiet    print only the board
// bun run storm --record   with a live provider, save the replies for replay mode
// LLM_PROVIDER=replay (the default) uses recorded replies and needs no key.
import { provider } from "../config/models";
import { saveRecording, startRecording } from "../config/llm";
import { stateDir } from "../world/lib/oms";
import { runStorm } from "./harness";
import { boardLines, computeBoard } from "./board";

const quiet = process.argv.includes("--quiet");
// --record with a live provider saves every reply to world/replay/storm-night.json for replay mode.
const record = process.argv.includes("--record");
try {
  const p = provider();
  if (!quiet) console.log(`Provider: ${p}${p === "replay" ? " (recorded replies, no key needed)" : ""}`);
  if (record && p === "replay") throw new Error("--record needs a live provider. Set LLM_PROVIDER and its key in .env.");
  if (record) startRecording(`Recorded from a live ${p} run of the sample design on ${new Date().toISOString().slice(0, 10)}.`);
  const res = await runStorm(stateDir(), { log: quiet ? undefined : (s) => console.log(s) });
  if (record) saveRecording();
  console.log("");
  for (const l of boardLines(computeBoard(res.dir))) console.log(l);
  console.log("");
  console.log("Storm night replayed. The OMS is in world/state/oms.db, model calls in world/state/ledger.jsonl.");
} catch (e) {
  console.log(`The storm run stopped: ${(e as Error).message}`);
  process.exit(2);
}
