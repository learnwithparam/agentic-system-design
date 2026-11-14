# Help: Design the restart

## If you get stuck

| What you see                                               | Fix                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| `FAIL run state lives outside the process ...`             | `memory` dies with the process. Use `oms` or `append-only-log`. |
| `FAIL every write tool in Tools has an idempotency key`    | Add an entry for each tool with `action: write`.                |
| `FAIL every key is built from the action's own fields ...` | Replace `uuid` or `time` with fields such as `outage`.          |

## Words you will use

- **Run state**: the record of how far one run got.
- **Idempotency key**: a label on a write. The same write with the same key happens only once.
- **Resume**: start again from the run state, not from the beginning.
- **Budget**: the most steps and dollars one run may spend before it stops.
