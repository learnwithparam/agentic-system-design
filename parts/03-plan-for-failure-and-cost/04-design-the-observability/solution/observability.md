# Observability

## Observability

Every record of one run carries the same `run_id`, so one search shows the whole story of a bad close or a
looping agent. Each signal has a number and one person, so an alert is never a hope.

```yaml design
run_id_field: run_id
signals:
  - failure: the agent closes an outage while homes behind it are still dark
    signal: blocked closes, counted for each run
    source: events
    field: blocked_close_count
    alert_above: 1
    unit: blocked closes
    tells: desk-lead
    action: read the meters again and decide by hand whether the outage can close
  - failure: the OMS does not answer a crew_assign call
    signal: seconds the OMS takes to answer crew_assign
    source: events
    field: crew_assign_seconds
    alert_above: 30
    unit: seconds
    tells: on-call-engineer
    action: check the OMS connection and restart the run with the same key
  - failure: the desk lead does not answer a gate before its deadline
    signal: age of the oldest open gate
    source: events
    field: oldest_gate_age
    alert_above: 15
    unit: minutes
    tells: duty-manager
    action: answer the open gate or hand it to another desk lead
  - failure: the OMS shows a crew on a different outage than the run state says
    signal: crews where the OMS and the run state disagree
    source: run-state
    field: crew_mismatch_count
    alert_above: 1
    unit: crews
    tells: desk-lead
    action: trust the OMS, accept the repaired run state and tell the crew
  - failure: the crew agent loops on one outage and keeps calling the model
    signal: dollars spent by one run
    source: ledger
    field: run_cost_usd
    alert_above: 2
    unit: dollars
    tells: on-call-engineer
    action: stop the run and plan that outage by hand
```
