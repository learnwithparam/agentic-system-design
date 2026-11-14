# Design: the Copperbeck Power storm desk

## Rollout

The desk goes live in steps. At first the agent only suggests, and a person acts. The share of reports it
handles grows only when the evals hold, and a stop rule can pull it back at any point.

```yaml design
rollout:
  stages:
    - name: shadow
      share_percent: 0
      who_acts: person
      advance_when: the crew plan agrees with the desk lead on most of the replayed storm nights
    - name: small
      share_percent: 10
      who_acts: person
      advance_when: every eval holds its pass mark on a full week of real reports
    - name: wide
      share_percent: 50
      who_acts: agent
      advance_when: every eval holds its pass mark and no stop rule fired during one real storm
    - name: full
      share_percent: 100
      who_acts: agent
      advance_when: the desk lead signs off after a storm
  stop_when:
    - metric: outages closed while a meter behind them is still dark
      rule: P2
    - metric: critical customers who got a restore time with no person on the call
      rule: P3
    - metric: dollars spent in one run
  rollback:
    how: Turn the share to 0 so every report goes back to the desk by hand, with no deploy needed.
    owner: person
    tested: true
```
