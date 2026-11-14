# Help: Write the outcome

## If you get stuck

| What you see                                        | Fix                                                                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `FAIL the metric has a name, a number and a unit`   | Write only the number after `target:`, and put the unit in `unit:`. The unit goes in `unit:`.                          |
| `FAIL the must-never covers at least one hard rule` | Rules P2 and P3 in `world/policy.md` are the ones a machine could break.                                               |
| `FAIL the system of record is the OMS`              | Name tables that exist, such as `outages`, `meter_reads`, `calls`. A notes file or the agent's memory is not a record. |
| `FAIL done is a check against OMS records`          | Replace "the agent reports it is fixed" with what the meters in `meter_reads` show.                                    |

## Words you will use

- **Outcome**: the change in the world the system exists to make.
- **Metric**: the number that tells you how well the system meets the outcome.
- **Must-never**: an action the system may never take, whatever the model decides.
- **System of record**: the place the business treats as the truth. Here, it is the OMS.
