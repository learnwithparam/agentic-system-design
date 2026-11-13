---

status: accepted

---

# Only the crew job is an agent

## Context and Problem Statement

The operations director asked for "an AI agent for storm nights". The desk has four jobs. One agent for
all of them would use about 4 times the tokens of a chat on every report. Which jobs need an agent?

This decides the [Shape](../design.md#shape) section.

## Considered Options

- Group the reports in a workflow, write texts in one call, plan crews with one agent
- One agent for every machine job
- Many agents, one for each job

## Decision Outcome

Chosen option: "Group the reports in a workflow, write texts in one call, plan crews with one agent". Only
the crew plan has steps nobody can write down in advance.

### Consequences

- Good, because 4,200 reports go through code and a fast model call, not an agent loop.
- Good, because the agent's tools stay few and easy to gate.
- Bad, because a strange report that code cannot route waits for a person.

### Confirmation

`bun run verify place-on-the-ladder` passes, and `bun run verify pick-the-pattern` shows the agent's token
multiplier in the published range.
