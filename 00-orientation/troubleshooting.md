# When something goes wrong

When a script fails, it prints a message. Every one of those messages is in the table below.

Find the message you see in the first column. The second column says what it means. The third column
says how to fix it.

For example, say you type a step name with a typo:

```bash
bun run verify place-the-ladder
```

Expect: `There is no step called "place-the-ladder". Steps:` and then the list of step names.

The full output looks like this:

```text
There is no step called "place-the-ladder". Steps:
  bun run verify meet-the-outage-desk
  bun run verify place-on-the-ladder
  bun run verify write-the-outcome
  bun run verify pick-the-pattern
```

Find `There is no step called "..."` in the table. The fix is to copy a name from the list. Here, the
right name is `place-on-the-ladder`.

A few words in the table:

- Replay mode plays back model replies that were saved before. It is the default, and it needs no key.
- The OMS is the outage management system, the database of every outage. It lives in `world/state/oms.db`.
- A provider is the company whose model you call, such as `anthropic`.

| What you see                                                               | What it means                                                                            | Fix                                                                                           |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `bun: command not found`                                                   | Bun is not on your computer yet.                                                         | Install it from bun.sh. Then open a new terminal.                                             |
| `There is no step called "..."`                                            | The step name has a typo.                                                                | Copy a name from the list it prints.                                                          |
| `There is no part called "..."`                                            | The part name has a typo.                                                                | Copy a name from the list it prints.                                                          |
| `Name a step. Steps:`                                                      | `bun run verify` needs a step name.                                                      | Add one, such as `bun run verify place-on-the-ladder`.                                        |
| `ERROR the check for ... could not load`                                   | The check itself is broken. Your work is not the problem.                                | Open an issue and paste the full output.                                                      |
| `FAIL ...` then `Try next: ...`                                            | Your work does not meet one rule of the step yet.                                        | Do what the `Try next` line says. Then run the check again.                                   |
| `Unknown command "...". Use: bun run world, or bun run world reset`        | `bun run world` takes no other word.                                                     | Run `bun run world` or `bun run world reset`.                                                 |
| `No OMS at .... Run: bun run world reset`                                  | The OMS file is gone, or it was never built.                                             | Run `bun run world reset`.                                                                    |
| `The storm run stopped: No recorded reply for this ... call`               | A prompt in `finished/prompts.ts` changed. Replay has no saved reply for the new prompt. | Run `git checkout finished/`. Or set `LLM_PROVIDER` and a key to run it live.                 |
| `The storm run stopped: No replay file at world/replay/storm-night.json`   | The replay file is missing.                                                              | Run `git checkout world/replay`.                                                              |
| `LLM_PROVIDER is "...". Use replay, anthropic, openrouter or openai.`      | `.env` names a provider the course does not know.                                        | Fix `LLM_PROVIDER` in `.env`. Or delete the line to use replay.                               |
| `LLM_PROVIDER is ... but ..._API_KEY is empty. Put it in .env.`            | You chose a live provider but gave no key for it.                                        | Add the key to `.env`, or set `LLM_PROVIDER=replay`.                                          |
| `FAIL ... recorded replies missing`                                        | `bun run models` cannot find the replay file.                                            | Run `git checkout world/replay`.                                                              |
| `... role(s) failed. See 00-orientation/troubleshooting.md.`               | A live model call failed, or gave a strange answer.                                      | Read the line above it. It is often a wrong key, no credit or no network. Replay still works. |
| `FAIL the finished system gives the same board on three fresh replay runs` | Someone changed the sample design or the world's start files.                            | Run `git checkout finished/ world/`, then `bun run world reset`.                              |
| `the finished system failed to run (exit ...)`                             | `bun run storm` could not run inside a check.                                            | Run `bun run storm` yourself to see the message. Then find that message in this table.        |
| `The storm run stopped: --record needs a live provider.`                   | Recording saves replies from a live model, so replay cannot record.                      | Set `LLM_PROVIDER` and its key in `.env`. Or run without `--record`.                          |
