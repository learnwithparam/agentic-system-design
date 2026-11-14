# Help: Size the load for one storm night

## If you get stuck

| What you see                                      | Fix                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `FAIL the load is the storm night ...`            | The storm month is 16,000 reports. The night is the smaller one. |
| `FAIL every job a machine does has a latency ...` | Write `budget_seconds: 5`, a bare number with no unit word.      |
| `FAIL the crew plan, a loop of calls ...`         | A loop makes several calls, so it needs the longest budget.      |

## Words you will use

- **Latency**: how long a job takes from start to answer.
- **Capacity**: how much work the system can take in before it slows down.
- **Requirement**: something a person needs the system to do.
