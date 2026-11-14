# Help: Place on the ladder

## If you get stuck

| What you see                                              | Fix                                                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `FAIL design.md has a Shape section`                      | Keep the fence line exactly as ` ```yaml design `. Indent with spaces, not tabs.             |
| `FAIL ... matches its rung`                               | A workflow is still decided by code, even when one step calls a model.                       |
| `FAIL ... reserves for a person`                          | Policy rule P1 says no software operates a switch.                                           |
| `FAIL at least one machine job sits below the agent rung` | Ask of each job: could I write every step down before it starts? If yes, it is not an agent. |

To compare, run `bun run verify place-on-the-ladder solution` and read `../solution/design.md`.

## Words you will use

- **Rung**: one level of the ladder, from a person doing the job to many agents doing it.
- **Workflow**: a fixed recipe in code. A model may do one step, but code picks the next step.
- **Agent**: a loop where the model picks the next step. It calls tools until it decides it is done.
- **Trigger**: what starts a job: a person, an event such as a new report, a schedule, or an agent.
