# Help: Name the failures

## If you get stuck

| What you see                                          | Fix                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| `FAIL there is one failure of each of the five kinds` | Look at the kinds table. Add a row for the kind you left out. |
| `FAIL every caught_by names a check ...`              | Start with "a check reads ..." and say what it compares.      |

## Words you will use

- **Failure mode**: one way the system can go wrong.
- **Check**: code that reads a record, compares it with a rule, and acts when the rule breaks.
- **Monitoring**: a person watching a screen. It is not a check.
- **Escalate**: pass a question to the next person up, such as the duty manager.
- **Ledger**: the file of every model call and its cost, `world/state/ledger.jsonl`.
