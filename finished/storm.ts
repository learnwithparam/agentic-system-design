// bun run storm            replay the sample design through the storm night, then print the board
// bun run storm --quiet    print only the board
// LLM_PROVIDER=replay (the default) uses recorded replies and needs no key.
import { provider } from "../config/models";
import { stateDir } from "../world/lib/oms";
import { runStorm } from "./harness";
import { boardLines, computeBoard } from "./board";

const quiet = process.argv.includes("--quiet");
try {
  const p = provider();
  if (!quiet) console.log(`Provider: ${p}${p === "replay" ? " (recorded replies, no key needed)" : ""}`);
  const res = await runStorm(stateDir(), { log: quiet ? undefined : (s) => console.log(s) });
  console.log("");
  for (const l of boardLines(computeBoard(res.dir))) console.log(l);
  console.log("");
  console.log("Storm night replayed. The OMS is in world/state/oms.db, model calls in world/state/ledger.jsonl.");
} catch (e) {
  console.log(`The storm run stopped: ${(e as Error).message}`);
  process.exit(2);
}
