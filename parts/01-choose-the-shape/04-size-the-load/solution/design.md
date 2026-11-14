# Design: the Copperbeck Power storm desk

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
