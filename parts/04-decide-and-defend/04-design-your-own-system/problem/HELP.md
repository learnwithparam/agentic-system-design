# Help: Design your own system

## If you get stuck

| What you see                                 | Fix                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------- |
| `FAIL every write that cannot be undone ...` | Add a gate that lists that tool. Set `on_timeout` to `wait`.        |
| `FAIL at least two evidence files ...`       | Make the files first. Then list their paths under `## Evidence`.    |
| `FAIL the cost per outcome ...`              | Use numbers, not words. If cost is above value, rethink the design. |

## Words you will use

- **Artefact**: a file you made that someone else can check.
- **Evidence**: a real file that shows your system ran, such as a log.
- **Rung**: how much the model decides, from a person up to many agents.
