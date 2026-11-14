# Design: the Copperbeck Power storm desk

Your design doc. Each section has prose for people and one `yaml design` block for the checks.

## Shape

Four jobs hide inside "an AI agent for storm nights". Only one of them has steps nobody can write down in
advance: which crew goes where next depends on what is broken, who is free and who is critical, and that
changes every few minutes. Grouping reports is a fixed recipe with one messy part (reading free text), so it
is a workflow. The customer text is one model call. Switching is a person's job by policy.

```yaml design
jobs:
  - job: group-the-reports
    rung: workflow
    decides_next_step: code
    trigger: event
    lifetime: 5 minutes
    why: Every report follows the same steps (read the address, find the device, attach or open an outage), so code can decide each step.
  - job: write-the-customer-updates
    rung: one-call
    decides_next_step: code
    trigger: agent
    lifetime: 10 seconds
    why: One message per outage from facts we already hold; there is no next step to choose.
  - job: plan-the-crews
    rung: agent
    decides_next_step: model
    trigger: event
    lifetime: 20 minutes
    reason: open-ended-steps
    why: Which crew goes next depends on faults, free crews and critical customers that change all night, and the number of steps is not known in advance.
  - job: switch-the-feeder
    rung: person
    decides_next_step: person
    trigger: person
    lifetime: 15 minutes
    why: Policy rule P1 says only an authorised switching engineer may operate a switch, so no machine sits on this job.
```

## Outcome

The desk exists to get the right crew to the right fault fast and to tell people the truth about when power
comes back. The metric is the median minutes from the first report of a fault to a crew assigned to it. The
must-nevers come straight from the desk policy, and "done" is read from the OMS, never from anyone's word.

```yaml design
outcome: Every storm report sits on the right outage, and every outage gets a crew and an honest restore time.
metric:
  name: median minutes from the first report of a fault to a crew assigned
  target: 45
  unit: minutes
must_never:
  - The system never closes an outage while a smart meter behind its device still reports no power.
  - The system never gives a critical customer a restore time without a person on the call.
system_of_record:
  name: oms
  records: [outages, meter_reads, calls, report_links]
done_when:
  - check: every outage in the outages table is closed and every smart meter behind its device reports power in meter_reads
    reads: [outages, meter_reads]
  - check: every critical customer behind a closed outage has a row in calls made by a person
    reads: [calls, customers, outages]
```

## Pattern

```yaml design
patterns:
  - job: group-the-reports
    pattern: route
    rejected: single-call
    why_not_simpler: Smart meter alarms already name the customer and need no model, while phone and text reports need one, so code routes each report by channel instead of sending all 4,200 to one call.
  - job: write-the-customer-updates
    pattern: single-call
    rejected: none
    why_not_simpler: A fixed template cannot say which streets are out and adapt the words, but one call with the facts is enough.
  - job: plan-the-crews
    pattern: agent-loop
    rejected: chain
    token_multiplier: 4
    why_not_simpler: A fixed chain cannot react when a repair uncovers a second fault or a crew frees early, which happens on most storm nights.
  - job: switch-the-feeder
    pattern: person
```

## Tools

The crew agent holds most of the tools, because it is the job where the model picks the next step. The
grouping workflow holds one tool: it opens an outage when reports point at a new device. Two writes cannot be
undone: a text that has reached a phone, and a closed outage. Both are tier high, so both get a gate.

```yaml design
tools:
  - name: oms_read_outage
    job: plan-the-crews
    action: read
    reversible: true
    impact: none
    tier: low
    response_cap_tokens: 2000
    error_format: Outage OUT-099 is not in the OMS. Read the waiting list again and pick one of those ids.
  - name: oms_read_meters
    job: plan-the-crews
    action: read
    reversible: true
    impact: none
    tier: low
    response_cap_tokens: 1000
    error_format: Device R-F99 has no smart meters behind it. Check the device id on the outage and try again.
  - name: oms_open_outage
    job: group-the-reports
    action: write
    reversible: true
    impact: none
    tier: medium
    response_cap_tokens: 500
    error_format: Device FU-F04-2 already has open outage OUT-010. Attach the report to OUT-010 instead.
  - name: crew_assign
    job: plan-the-crews
    action: write
    reversible: true
    impact: money
    tier: medium
    response_cap_tokens: 500
    error_format: CREW-5 is not free until minute 260. Pick a crew from the free list or wait for the next turn.
  - name: notify_customers
    job: plan-the-crews
    action: write
    reversible: false
    impact: safety
    tier: high
    response_cap_tokens: 500
    error_format: Outage OUT-005 has no restore time yet. Assign a crew first, then send the text.
  - name: oms_close_outage
    job: plan-the-crews
    action: write
    reversible: false
    impact: safety
    tier: high
    response_cap_tokens: 500
    error_format: 103 smart meters behind R-F05 are still dark. Read the meters again after the next repair.
```

## Memory

The OMS owns every record about the network, so those facts live there and nowhere else. The agent sees a
small slice of them on each call. The run keeps its own list of the crews it sent, so a restart does not
send them twice. Only one fact is a long-term note: how long repairs took on past storms, which the OMS does
not keep.

```yaml design
context_cap_tokens: 8000
facts:
  - fact: outages
    layer: system-of-record
    writer: oms_open_outage
    reader: plan-the-crews
    expires: never, the OMS keeps every outage
  - fact: meter reads
    layer: system-of-record
    writer: the smart meters
    reader: oms_read_meters
    expires: never, the OMS keeps every read
  - fact: calls to critical customers
    layer: system-of-record
    writer: person:desk-lead
    reader: plan-the-crews
    expires: never, the OMS keeps every call
  - fact: report links
    layer: system-of-record
    writer: group-the-reports
    reader: group-the-reports
    expires: never, the OMS keeps every link
  - fact: crews and when each is free
    layer: system-of-record
    writer: crew_assign
    reader: plan-the-crews
    expires: never, the OMS keeps every crew
  - fact: customers behind each device
    layer: system-of-record
    writer: the customer team
    reader: notify_customers
    expires: never, the OMS keeps every customer
  - fact: the waiting outages and free crews for this turn
    layer: context
    writer: the harness
    reader: plan-the-crews
    expires: at the end of the model call
  - fact: the crews this run has sent, keyed outage:crew
    layer: run-state
    writer: crew_assign
    reader: plan-the-crews
    expires: at the end of the run
  - fact: repair minutes for fuses and reclosers on past storms
    layer: notes
    writer: plan-the-crews
    reader: plan-the-crews
    expires: replaced after each storm
```

## Gates

The two tier-high tools each wait for the desk lead. A third gate covers rule P3: every critical customer
hears the restore time from a person. Every gate fires once per outage or once per critical call, never per
report. So a storm month gives the desk lead about 12 gates a shift. That leaves time to read each one.

```yaml design
limit_per_shift: 30
gates:
  - gate: close-the-outage
    tools: [oms_close_outage]
    trigger: the agent asks to close an outage after the crew says the repair is done
    decides: desk-lead
    answers: [accept, respond, ignore]
    deadline_minutes: 15
    on_timeout: wait
    per: outage
    count: 1
  - gate: send-the-restore-time
    tools: [notify_customers]
    trigger: the agent asks to text the customers behind an outage their restore time
    decides: desk-lead
    answers: [accept, edit, ignore]
    deadline_minutes: 10
    on_timeout: wait
    per: outage
    count: 1
  - gate: call-the-critical-customer
    tools: [notify_customers]
    trigger: a critical customer, such as a hospital or care home, sits behind the outage
    decides: desk-lead
    answers: [accept, edit, respond]
    deadline_minutes: 10
    on_timeout: escalate
    per: critical-call
    count: 1
```

## Failures

Each failure has a check that reads the OMS, the events log or the ledger. None waits for someone to notice.
The P2 row is the one the storm board shows: `BLOCKED close of OUT-005`.

```yaml design
failures:
  - failure: the agent closes an outage while homes behind it are still dark
    kind: model-wrong
    shows_up_as: oms_close_outage is called while smart meters behind the device report no power
    caught_by: a check reads meter_reads for every meter behind the device before each close
    system_does: blocks the close and opens a new outage on each dark branch
  - failure: the OMS does not answer a crew_assign call
    kind: tool-fails
    shows_up_as: crew_assign returns a timeout error instead of assigned
    caught_by: the harness checks every tool reply against the expected result before the next turn
    system_does: retries once with the same idempotency key, then hands the outage to the desk lead
  - failure: the desk lead does not answer a gate before its deadline
    kind: person-silent
    shows_up_as: a gate stays open past its deadline_minutes with no answer
    caught_by: a check compares each open gate's age in the events log with its deadline
    system_does: escalates the gate to the duty manager and keeps the action waiting
  - failure: the OMS shows a crew on a different outage than the run state says
    kind: record-disagrees
    shows_up_as: the crew column in outages differs from the crews this run has sent
    caught_by: a check compares the run state with the outages table at the start of every turn
    system_does: trusts the OMS, rewrites the run state from it and tells the desk lead
  - failure: the crew agent loops on one outage and keeps calling the model
    kind: cost-runaway
    shows_up_as: the ledger shows many smart calls for one outage with no new tool result
    caught_by: a check sums the ledger cost and step count for each run against the run budget
    system_does: stops the run and asks the desk lead to plan that outage by hand
```

## Restart

Run state lives in the OMS, so a fresh process can read where the last one stopped. Every write carries a
key built from its own fields. So when the restart repeats a write, the OMS sees the same key and does
nothing new. A run stops and asks the desk lead after 40 steps or 50 cents.

```yaml design
run_state:
  lives_in: oms
  resume: a fresh process reads the outages table and the events log, then repeats each write that has no result, with the same key
idempotency:
  - tool: crew_assign
    key: outage:crew
  - tool: oms_open_outage
    key: device
  - tool: notify_customers
    key: outage:etr
  - tool: oms_close_outage
    key: outage
budget:
  steps_per_run: 40
  dollars_per_run: 0.5
  when_hit: stop-and-ask
```

## Load

Four things set the size of the build: what people need, how fast each job must answer, how much work
arrives, and how many model calls that work costs. A smart meter alarm already names the customer, so only
phone and text reports need a model.

```yaml design
requirements:
  - A customer who reports a fault sees it on an outage within a short time.
  - A critical customer hears from a person before any restore time goes out.
  - A crew gets one clear next job and is never sent twice to the same outage.
load:
  reports_per_night: 4200
  outages_per_night: 31
latency:
  - job: group-the-reports
    budget_seconds: 5
    why: A report that waits longer than a few seconds piles up behind thousands more.
  - job: write-the-customer-updates
    budget_seconds: 10
    why: The text should reach the customer while the crew plan is still fresh.
  - job: plan-the-crews
    budget_seconds: 120
    why: A crew plan is a loop of several calls, and a crew only needs it before it leaves the depot.
capacity:
  reports_needing_model: 2900
  calls_per_night: 3100
```

## Evals

An eval is a test set for an agent. Each job gets its own, because a good crew plan says nothing about a good
customer text. A model may grade the words, but a person checks the model first.

```yaml design
evals:
  - job: group-the-reports
    question: Does each report land on the right outage?
    cases: 40
    source: reports from a past storm with the right outage already known
    grader: code
    pass_mark: 0.95
    gate: block-release
  - job: write-the-customer-updates
    question: Is each text true, clear and free of a promise we cannot keep?
    cases: 20
    source: texts written for a past storm
    grader: model
    checked_by_person: 10
    pass_mark: 0.9
    gate: block-release
  - job: plan-the-crews
    question: Does each plan send a free crew to the worst fault, and never break a hard rule?
    cases: 15
    source: three past storm nights replayed from the OMS
    grader: code
    pass_mark: 1
    covers_rules: [P2, P3]
    gate: block-release
```

## Rollout

The desk goes live in steps. At first the agent only suggests, and a person acts. The share of reports it
handles grows only when the evals hold, and a stop rule can pull it back at any point.

```yaml design
rollout:
  stages:
    - name: shadow
      share_percent: 0
      who_acts: person
      advance_when: the crew plan agrees with the desk lead on most of the replayed storm nights
    - name: small
      share_percent: 10
      who_acts: person
      advance_when: every eval holds its pass mark on a full week of real reports
    - name: wide
      share_percent: 50
      who_acts: agent
      advance_when: every eval holds its pass mark and no stop rule fired during one real storm
    - name: full
      share_percent: 100
      who_acts: agent
      advance_when: the desk lead signs off after a storm
  stop_when:
    - metric: outages closed while a meter behind them is still dark
      limit: 0
      rule: P2
    - metric: critical customers who got a restore time with no person on the call
      limit: 0
      rule: P3
    - metric: dollars spent in one run
      limit: 5
  rollback:
    how: Turn the share to 0 so every report goes back to the desk by hand, with no deploy needed.
    owner: person
    tested: true
```
