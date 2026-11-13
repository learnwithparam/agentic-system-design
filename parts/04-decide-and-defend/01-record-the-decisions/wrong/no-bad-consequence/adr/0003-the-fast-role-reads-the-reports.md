---

status: accepted

---

# The fast role reads the reports

## Context and Problem Statement

Most model calls on a storm night read one report each: 98 calls per outage. The crew agent makes about 4.
Which role should each job use, so a storm month stays under budget?

This decides the [cost](../cost.yaml).

## Considered Options

- Fast role for reports and texts, smart role for the crew agent
- Smart role for every call
- Fast role for every call, the crew agent included

## Decision Outcome

Chosen option: "Fast role for reports and texts, smart role for the crew agent". One outage costs about half
a cent, and a storm month about two dollars against a budget of twenty.

### Consequences

- Good, because the cheap role carries the most calls.
- Good, because the crew plan, the hardest choice, gets the stronger model.

### Confirmation

`bun run verify price-the-outcome` passes: cost per outcome below its value, and the storm month under
budget.
