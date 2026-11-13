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
