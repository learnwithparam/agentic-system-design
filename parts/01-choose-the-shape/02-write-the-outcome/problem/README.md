# Write the outcome

## The problem

Think back to the storm night you watched in orientation. Twice, the sample design's agent tried to close an
outage because the crew said it was fixed. But smart meters behind those outages were still dark.

Picture a design that says "done" whenever the agent says done. It would send the crews home and leave a
care home without power. So before you pick a pattern, you write down four things:

- what success means,
- how you measure it,
- what must never happen,
- where the truth lives.

```mermaid
flowchart LR
  O[Outcome: what a person sees] --> M[Metric: a number and a unit]
  O --> N[Must-never: from the desk policy]
  O --> S[System of record: OMS tables]
  S --> D[Done when: a check on those tables]
```

## Your challenge

Your Shape section is already in `design.md`. You may paste in your own from the last step if you prefer
it. Under `## Outcome`, fill the block:

| Field              | What to write                                                         |
| ------------------ | --------------------------------------------------------------------- |
| `outcome`          | One sentence a person at Copperbeck can see happen                    |
| `metric`           | `name`, `target` (a plain number) and `unit`                          |
| `must_never`       | One or more lines, each `The system never ...`                        |
| `system_of_record` | `name: oms` and the `records` (OMS tables) your outcome depends on    |
| `done_when`        | Each item has a `check` a person could run, and the tables it `reads` |

For example, the sample answer in `../solution/design.md` writes its metric and one done check like this:

```yaml
metric:
  name: median minutes from the first report of a fault to a crew assigned
  target: 45
  unit: minutes
done_when:
  - check: every outage in the outages table is closed and every smart meter behind its device reports power in meter_reads
    reads: [outages, meter_reads]
```

The target is a plain number, and the unit has its own line. The check reads two OMS tables. It does not
take anyone's word.

The OMS tables are listed in `world/README.md`. To see them yourself:

```bash
bun run world
```

Expect: `The world is ready. Next: bun run storm`

## Done when

- `design.md` has an Outcome section with a `yaml design` block.
- The outcome is a sentence of at least 8 words.
- The metric has a name, a number and a unit.
- Every must-never contains the word never.
- At least one must-never covers a hard rule in `world/desk.yaml`.
- The system of record is the OMS, and every record it names is an OMS table.
- Every done check reads OMS tables. It never relies on someone saying it is done.

```bash
bun run verify write-the-outcome
```

Expect: `Done. All 7 rules pass.` and a `Progress:` line.

## If you get stuck

| What you see                                        | Fix                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `FAIL the metric has a name, a number and a unit`   | Write `target: 45`, not `target: 45 minutes`. The unit goes in `unit:`.                                                   |
| `FAIL the must-never covers at least one hard rule` | Rules P2 and P3 in `world/policy.md` are the ones a machine could break.                                                  |
| `FAIL the system of record is the OMS`              | Name tables that exist, such as `outages`, `meter_reads`, `calls`. A notes file or the agent's memory is not a record.    |
| `FAIL done is a check against OMS records`          | Replace "the agent reports it is fixed" with what the meters in `meter_reads` show.                                       |

## Words you will use

- **Outcome**: the change in the world that the system exists to make.
- **Metric**: the number that tells you how well the system meets the outcome.
- **Must-never**: an action the system may never take, whatever the model decides.
- **System of record**: the place the business treats as the truth. Here, it is the OMS.
- **OMS table**: one table in the OMS database, such as `outages` or `meter_reads`.
