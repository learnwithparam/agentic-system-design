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
