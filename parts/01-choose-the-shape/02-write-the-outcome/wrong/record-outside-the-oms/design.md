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
  records: [crew_whiteboard, agent_memory]
done_when:
  - check: every outage in the outages table is closed and every smart meter behind its device reports power in meter_reads
    reads: [outages, meter_reads]
  - check: every critical customer behind a closed outage has a row in calls made by a person
    reads: [calls, customers, outages]
```
