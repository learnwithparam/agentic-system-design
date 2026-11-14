# Threats

## Threats

Each threat enters through text the agent reads, and ends at a tool. The two tools that cannot be undone sit
behind gates, so a fooled model still cannot send a text or close an outage alone.

```yaml design
threats:
  - threat: a customer report says to close the outage and ignore the meters
    kind: prompt-injection
    enters_through: the free text of a phone or web report
    reaches: oms_close_outage
    control: the close waits at a gate and a check reads the meters before the desk lead sees it
    control_kind: tier
  - threat: a report asks the agent to text a made-up restore time to every customer
    kind: prompt-injection
    enters_through: the free text of a web report
    reaches: notify_customers
    control: every text waits at a gate where the desk lead reads the words before they go
    control_kind: gate
    gate: send-the-restore-time
  - threat: the crew agent can assign crews to any outage, not only the ones on its waiting list
    kind: too-much-power
    enters_through: a wrong outage id typed by the model
    reaches: crew_assign
    control: crew_assign accepts only ids that the OMS lists as waiting, and rejects all others
    control_kind: allowlist
  - threat: a tool reply returns customer phone numbers that the agent then repeats in a note
    kind: data-leak
    enters_through: the reply of oms_read_outage
    reaches: oms_read_outage
    control: the response cap and a field list stop the reply from carrying phone numbers at all
    control_kind: cap
```
