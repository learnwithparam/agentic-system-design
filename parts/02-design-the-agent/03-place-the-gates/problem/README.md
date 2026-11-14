# Place the gates

## The problem

A gate is a stop where a person must say yes before an action runs. A gate only works if the person reads
what they approve.

```mermaid
sequenceDiagram
  participant A as Crew agent
  participant G as Gate
  participant L as Desk lead
  A->>G: notify_customers for OUT-005
  G->>L: approve this text?
  alt answers in 10 minutes
    L-->>G: accept, edit, respond or ignore
  else no answer
    G-->>A: wait, never proceed
  end
```

## Watch it done

Check the starter:

```bash
bun run verify place-the-gates
```

Expect:

```text
FAIL  every gate names its tools, trigger, the person who decides, answers and deadline
FAIL  every tier-high tool has a gate
1 of 6 rules pass. Fix the FAIL lines and run it again.
```

Then the answer:

```bash
bun run verify place-the-gates solution
```

Expect:

```text
Done. All 6 rules pass.
```

## Your turn

Anthropic found that people "accept 93%" of the permission prompts Claude Code shows them
([Claude Code auto mode](https://www.anthropic.com/engineering/claude-code-auto-mode)). People click yes
when they see too many prompts. So a gate people click through is not a gate.

On a storm night the desk lead is tired and busy. Every gate you add takes some of their attention.

Find `## Gates` in `design.md`. Add one gate for every tier-high tool, and one for rule P3 in
`world/policy.md`. Give each gate:

- `gate`: a short name. `tools`: the tools it stops, from your Tools section.
- `trigger`: what makes it fire. `decides`: the person who answers, such as `desk-lead`.
- `answers`: some of `accept`, `edit`, `respond` and `ignore`.
- `deadline_minutes` and `on_timeout`: `wait`, `escalate` or `cancel`. Never `proceed`.
- `per` and `count`: it fires `count` times per `outage`, `report` or `critical-call`.

Then set `limit_per_shift`: the most gates one desk lead can read well in one shift.

The check counts the gates for you. It takes the storm month in `world/desk.yaml` (`420` outages, `16000`
reports, `260` critical calls). It spreads them over the shifts in a month of `480`-minute shifts. That is
90 shifts: 30 days of three shifts a day.

For example, the sample answer in `../solution/design.md` has two gates per outage and one per critical
call:

```text
(420 + 420 + 260) gates / 90 shifts = about 12 gates per shift
```

One gate per report instead would give `16000 / 90`, about 178 gates per shift. Nobody reads that many.

Then run the check and fix each FAIL:

```bash
bun run verify place-the-gates
```

Expect: `Done. All 6 rules pass.` and a `Progress:` line.

## Do it on your work

Make the same move on your own system, with your own tools, people and numbers.

Good looks like this: a stranger can name your tool, person and number.

## Done when

- `design.md` has Tools and Gates sections, each with a `yaml design` block.
- Every gate names its tools, trigger, the person who decides, answers and deadline.
- Every tier-high tool has a gate.
- No gate proceeds on timeout.
- Gates per desk lead per shift stay under your `limit_per_shift`, which is at most 240.
- A gate's trigger names critical customers, such as a hospital or care home.

## Solution

The finished files are in `solution/`. Compare:

```bash
diff -r problem solution
```

Expect: only the parts you fill in are different.

Stuck? See [HELP.md](HELP.md).
