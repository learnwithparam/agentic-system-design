# Design: the Copperbeck Power storm desk

## Load

Write what people need, how fast each job must answer, how much work arrives and how many model calls that is.

```yaml design
requirements:
  - TODO
load:
  reports_per_night: TODO
  outages_per_night: TODO
latency:
  - job: group-the-reports
    budget_seconds: TODO
    why: TODO
capacity:
  reports_needing_model: TODO
  calls_per_night: TODO
```
