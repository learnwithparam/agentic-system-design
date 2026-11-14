# Help: Design the observability

## If you get stuck

| What you see                            | Fix                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `FAIL every failure in design.md ...`   | Copy each `failure:` line from `design.md` exactly, then add a signal. |
| `FAIL every alert names one person ...` | Use a role such as `desk-lead`. Words like team or everyone fail.      |

## Words you will use

- **Observability**: records that let you ask the system why something happened.
- **Signal**: one number the system writes, with a source and a threshold.
- **Run id**: one label that every record of one run carries.
- **Threshold**: the number above which a person is told.
