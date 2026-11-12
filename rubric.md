# Project rubric

Every question here has a yes or no answer. There are no scores and no part marks.

A script answers the questions a script can answer. A grader answers the rest, also with yes or no. A
project passes when every answer is yes.

For example, question 3 asks if at least one machine job sits below the agent rung. The sample answer
for `place-on-the-ladder` has this row in its Shape section:

```text
  - job: group-the-reports
    rung: workflow
    decides_next_step: code
```

A workflow is below the agent rung, so the answer is yes. The check prints:

```text
  PASS  at least one machine job sits below the agent rung
```

## Words you will see here

- The ladder lists the ways to do a job, from plain code up to a full agent. Each level is a rung.
- An agent is a model that picks its own next step and calls tools.
- A workflow is a fixed list of steps that your code runs in order.
- The OMS is the outage management system, the database that holds the truth about every outage.
- The must-never is the one sentence your system must never break.
- A token multiplier says how many times more tokens a pattern uses than one chat. A token is a small
  piece of text, about three quarters of a word.
- A gate is a point where the system stops and waits for a person or a check before it acts.
- An idempotency key is a label on a write. If the same write runs twice, the key makes sure it happens
  only once.
- An ADR is an architecture decision record: a short page that says what you chose and why. MADR is one
  standard layout for it.
- In an ADR, a Confirmation says how you will check that the decision works. A bad consequence is one
  thing that gets worse because of the decision.
- A denominator is the number you divide by, such as "per outage" in "cost per outage".

## The deliverables

| Deliverable   | Where                        | Checked for                                                                                                       |
| ------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Design doc    | `design.md`                  | Sections Shape, Outcome, Pattern, Tools, Memory, Gates, Failures, Restart, each with a `yaml design` block        |
| Cost model    | `cost.yaml` and its board    | Every model call has a price; cost per outcome for a normal and a storm month at the volumes in `world/desk.yaml` |
| Failure modes | `## Failures` in `design.md` | At least five, one of each required kind, each caught by a named check                                            |
| ADRs          | `adr/0001-*.md` and two more | MADR 4.0.0 headings, at least two options, a bad consequence, a Confirmation                                      |
| Review        | `review-<case>.md`           | Every checklist item answered, every pass quoted from its source                                                  |

## Questions the script answers

| #   | Question                                                                                                                   | Step whose check answers it |
| --- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 1   | Does every step's check pass? (`bun run verify --report`)                                                                  | all                         |
| 2   | Is every job on the desk placed once, on a rung that matches who decides the next step?                                    | `place-on-the-ladder`       |
| 3   | Is at least one machine job below the agent rung?                                                                          | `place-on-the-ladder`       |
| 4   | Does the metric have a number and a unit? Does "done" read OMS tables, not anyone's word?                                  | `write-the-outcome`         |
| 5   | Does the must-never cover a hard rule in the desk policy?                                                                  | `write-the-outcome`         |
| 6   | Does every machine job reject a simpler pattern? Does every agent pattern state a token multiplier in the published range? | `pick-the-pattern`          |
| 7   | Does every tool that cannot be undone have a gate? Is that gate's timeout something other than "proceed"?                  | `place-the-gates`           |
| 8   | Does every write tool have an idempotency key?                                                                             | `design-the-restart`        |
| 9   | Is the cost per outcome below the value per outcome, for both months? Is the storm month under budget?                     | `price-the-outcome`         |
| 10  | Does each ADR name a Confirmation check and at least one bad consequence?                                                  | `record-the-decisions`      |
| 11  | Does every pass in the review quote text found in the saved copy of the source?                                            | `review-a-real-system`      |

## Questions a grader answers

| #   | Question                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------- |
| 12  | Does each "why the simpler pattern fails" name a fact of this world, not a general claim?            |
| 13  | Can someone check the must-never against the system of record without asking the model?              |
| 14  | Is the review question about a denominator or a gate?                                                |
| 15  | Does the walkthrough recording state the ladder choice and the cost per outcome in its first minute? |
