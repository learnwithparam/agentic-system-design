# Design: the storm desk, over-built

A team handed in this design for the same Copperbeck storm desk. It has five faults. Find them with the
checklist and the rules of the steps before this one.

## Shape

Every job gets its own agent, so the desk can grow later.

```yaml design
jobs:
  - job: group-the-reports
    rung: many-agents
    reason: parallel-breadth
  - job: write-the-customer-updates
    rung: agent
    reason: varied-input
  - job: plan-the-crews
    rung: agent
    reason: open-ended-steps
  - job: switch-the-feeder
    rung: agent
    reason: open-ended-steps
```

## Tools

```yaml design
tools:
  - name: oms_close_outage
    job: plan-the-crews
    action: write
    reversible: false
    tier: medium
```

## Memory

```yaml design
facts:
  - fact: outages
    layer: notes
    writer: plan-the-crews
    reader: plan-the-crews
```

## Restart

```yaml design
idempotency:
  - tool: crew_assign
    key: outage:uuid
```
