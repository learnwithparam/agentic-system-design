# My system

A sample for a different business, a small online shop. It shows the shape. Yours will use your own work.

## System

```yaml design
name: returns desk
outcome: a customer who sends a faulty item back gets a refund or a swap within one working day
owner: Ana, the shop manager
rung: agent
why_an_agent: every return arrives as free text in a different shape, so no fixed rules can sort them
```

## Tools

```yaml design
tools:
  - name: shop_read_order
    action: read
    reversible: true
    tier: low
  - name: shop_send_label
    action: write
    reversible: true
    tier: medium
  - name: shop_refund_payment
    action: write
    reversible: false
    tier: high
```

## Gates

```yaml design
gates:
  - gate: approve-the-refund
    tools: [shop_send_label]
    decides: shop manager
    on_timeout: wait
```

## Failures

```yaml design
failures:
  - failure: the agent refunds an order that was never delivered
    caught_by: a check reads the courier status before every refund
    system_does: blocks the refund and asks the manager to look at the order
  - failure: the courier site does not answer
    caught_by: a check compares each tool reply with the expected shape before the next step
    system_does: retries once, then puts the return on the manager's list
  - failure: the agent loops on one angry customer email
    caught_by: a check sums the model calls for each return against a cap of ten
    system_does: stops the run and hands the email to the manager
```

## Cost

```yaml design
cost_per_outcome_usd: 0.04
value_per_outcome_usd: 6
where_the_numbers_came_from: ten real returns from last month, model cost from the run log, value from the saved staff time
```

## Evidence

```yaml design
files:
  - path: evidence/run-log.txt
    shows: one full run of the returns desk on a real return, with the gate step
  - path: evidence/refund-check.txt
    shows: the output of the courier check blocking a refund on an undelivered order
```
