# When something goes wrong

Every message a script prints on failure is in this table.

| What you see | What it means | Fix |
|---|---|---|
| `bun: command not found` | Bun is not installed. | Install it from bun.sh, then open a new terminal. |
| `There is no step called "..."` | The step name is misspelled. | Copy a name from the list it prints. |
| `There is no part called "..."` | The part name is misspelled. | Copy a name from the list it prints. |
| `Name a step. Steps:` | `bun run verify` needs a step name. | Add one, such as `bun run verify place-on-the-ladder`. |
| `ERROR the check for ... could not load` | The check itself is broken, not your work. | Open an issue with the full output. |
| `FAIL ...` then `Try next: ...` | One rule of the step is not met yet. | Do what the `Try next` line says, then run the check again. |
| `Unknown command "...". Use: bun run world, or bun run world reset` | `bun run world` takes no other word. | Run `bun run world` or `bun run world reset`. |
| `No OMS at .... Run: bun run world reset` | The OMS file was deleted or never seeded. | Run `bun run world reset`. |
| `The storm run stopped: No recorded reply for this ... call` | A prompt in `finished/prompts.ts` changed, so replay has no reply for it. | Run `git checkout finished/`, or set `LLM_PROVIDER` and a key to run it live. |
| `The storm run stopped: No replay file at world/replay/storm-night.json` | The replay file is missing. | Run `git checkout world/replay`. |
| `LLM_PROVIDER is "...". Use replay, anthropic, openrouter or openai.` | `.env` names a provider the course does not know. | Fix `LLM_PROVIDER` in `.env`, or remove the line to use replay. |
| `LLM_PROVIDER is ... but ..._API_KEY is empty. Put it in .env.` | You chose a live provider without its key. | Add the key to `.env`, or set `LLM_PROVIDER=replay`. |
| `FAIL ... recorded replies missing` | `bun run models` cannot find the replay file. | Run `git checkout world/replay`. |
| `... role(s) failed. See 00-orientation/troubleshooting.md.` | A live call failed or answered oddly. | Read the line above it: a wrong key, no credit, or no network. Replay still works. |
| `FAIL the finished system gives the same board on three fresh replay runs` | The sample design or the world seed was changed. | Run `git checkout finished/ world/`, then `bun run world reset`. |
| `the finished system failed to run (exit ...)` | `bun run storm` could not run inside a check. | Run `bun run storm` yourself to see the message, then fix it from this table. |
| `The storm run stopped: --record needs a live provider.` | Recording saves live replies, so replay cannot record. | Set `LLM_PROVIDER` and its key in `.env`, or drop `--record`. |
