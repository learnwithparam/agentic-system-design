// bun run storm            replay the sample design through the storm night, then print the board
// bun run storm --quiet    print only the board
// bun run storm --record   with a live provider, save the replies for replay mode
// LLM_PROVIDER=replay (the default) uses recorded replies and needs no key.
import { saveRecording, startRecording } from "../config/llm";
import { provider } from "../config/models";
import { stateDir } from "../world/lib/oms";
import { boardLines, computeBoard } from "./board";
import { runStorm } from "./harness";

const quiet = process.argv.includes("--quiet");
// --record with a live provider saves every reply to world/replay/storm-night.json for replay mode.
const record = process.argv.includes("--record");

async function playTheStorm() {
  const chosenProvider = provider();
  if (!quiet) {
    const note = chosenProvider === "replay" ? " (recorded replies, no key needed)" : "";
    console.log(`Provider: ${chosenProvider}${note}`);
  }
  if (record && chosenProvider === "replay") {
    throw new Error("--record needs a live provider. Set LLM_PROVIDER and its key in .env.");
  }
  if (record) {
    const today = new Date().toISOString().slice(0, 10);
    startRecording(`Recorded from a live ${chosenProvider} run of the sample design on ${today}.`);
  }
  const log = quiet ? undefined : (line: string) => console.log(line);
  const result = await runStorm(stateDir(), { log });
  if (record) saveRecording();
  console.log("");
  for (const line of boardLines(computeBoard(result.dir))) console.log(line);
  console.log("");
  const where = "The OMS is in world/state/oms.db, model calls in world/state/ledger.jsonl.";
  console.log(`Storm night replayed. ${where}`);
}

try {
  await playTheStorm();
} catch (error) {
  console.log(`The storm run stopped: ${(error as Error).message}`);
  process.exit(2);
}
