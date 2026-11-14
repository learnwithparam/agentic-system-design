# Help: Pick the pattern

## If you get stuck

| What you see                                                 | Fix                                                                           |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `FAIL every pattern is on the list and fits the job's rung`  | Change the pattern, or go back and change the rung in Shape. They must agree. |
| `FAIL every machine job names a simpler pattern it rejected` | `rejected` must sit further left on the diagram above than your choice.       |
| `FAIL ... token multiplier`                                  | One agent: 3 to 5. Many agents: 10 to 20.                                     |

## Words you will use

- **Pattern**: the way the work flows through code and model calls for one job.
- **Route**: code sends each input down one of several paths. For example, meter alarms go one way and texts
  go another.
- **Chain**: fixed steps in order, each feeding the next.
- **Orchestrator-workers**: one model splits a task and hands the parts to other calls.
- **Token multiplier**: how many times more tokens a design uses than a single chat answer.
