# Project rubric

Every question has a yes or no answer. No scores, no partial credit. The script answers what a script can;
a grader answers the rest with the same yes or no. A project passes when every question is yes.

## The deliverables

| Deliverable | Where | Checked for |
|---|---|---|
| Design doc | `design.md` | Sections Shape, Outcome, Pattern, Tools, Memory, Gates, Failures, Restart, each with a `yaml design` block |
| Cost model | `cost.yaml` and its board | Every model call priced; cost per outcome for a normal and a storm month at the volumes in `world/desk.yaml` |
| Failure modes | `## Failures` in `design.md` | At least five, one of each required kind, each caught by a named check |
| ADRs | `adr/0001-*.md` and two more | MADR 4.0.0 headings, at least two options, a bad consequence, a Confirmation |
| Review | `review-<case>.md` | Every checklist item answered, every pass quoted from its source |

## Questions the script answers

| # | Question | Step whose check answers it |
|---|---|---|
| 1 | Does every step's check pass? (`bun run verify --report`) | all |
| 2 | Is every job on the desk placed once, with a rung that matches who decides the next step? | `place-on-the-ladder` |
| 3 | Is at least one machine job below the agent rung? | `place-on-the-ladder` |
| 4 | Does the metric have a number and a unit, and does done read OMS tables rather than anyone's word? | `write-the-outcome` |
| 5 | Does the must-never cover a hard rule in the desk policy? | `write-the-outcome` |
| 6 | Does every machine job reject a simpler pattern, and every agent pattern state a token multiplier in the published range? | `pick-the-pattern` |
| 7 | Does every tool that cannot be undone have a gate with a timeout that is not "proceed"? | `place-the-gates` |
| 8 | Does every write tool have an idempotency key? | `design-the-restart` |
| 9 | Is the cost per outcome below the value per outcome, for both months, and the storm month under budget? | `price-the-outcome` |
| 10 | Does each ADR name a Confirmation check and at least one bad consequence? | `record-the-decisions` |
| 11 | Does every pass in the review quote text found in the cached source? | `review-a-real-system` |

## Questions a grader answers

| # | Question |
|---|---|
| 12 | Does each "why the simpler pattern fails" name a fact of this world, not a general claim? |
| 13 | Can the must-never be checked against the system of record without asking the model? |
| 14 | Is the review question about a denominator or a gate? |
| 15 | Does the walkthrough recording state the ladder choice and the cost per outcome in its first minute? |
