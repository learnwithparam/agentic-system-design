# Design: the Copperbeck Power storm desk

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
    gate: block-release
```
