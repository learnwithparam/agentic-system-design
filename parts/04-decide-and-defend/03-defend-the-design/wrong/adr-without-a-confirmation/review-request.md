# Review request: the Copperbeck storm desk

Please review `design.md`, `cost.yaml` and the three ADRs in `adr/`. Push hardest on these three choices.

## Riskiest choices

```yaml design
choices:
  - choice: one smart agent plans every crew on the storm night
    section: Shape
    why_risky: if the agent picks badly, crews drive to the wrong faults while hospitals wait
    would_change_my_mind: a replay where a fixed rule beats the agent on median minutes to crew by 10 or more
  - choice: the desk lead approves every customer text, once per outage
    section: Gates
    why_risky: on a storm night the desk lead may click yes without reading, like 93% of prompts
    would_change_my_mind: more than 40 gates for one desk lead in one storm night shift
  - choice: the fast role reads every report, the smart role plans the crews
    section: cost.yaml
    why_risky: the crew agent is most of the cost, so a loop there runs up the bill
    would_change_my_mind: a storm month costing more than 10 dollars, half the budget of 20
```
