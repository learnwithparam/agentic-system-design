# Help: Plan the rollout in stages

## If you get stuck

| What you see                                 | Fix                                                              |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `FAIL the first stage is small ...`          | Begin with `share_percent: 0` or 10 and `who_acts: person`.      |
| `FAIL stop rules have a number ...`          | Each rule needs `limit: 0` or another number, and a `rule:` tag. |
| `FAIL the way back is owned by a person ...` | An agent cannot be the one to stop itself. Set `owner: person`.  |

## Words you will use

- **Rollout**: switching a change on in stages, not all at once.
- **Shadow**: the agent runs and suggests, but nothing it says is acted on.
- **Stop rule**: a number that, once crossed, pulls the change back.
- **Rollback**: the move that puts the old way back in place.
