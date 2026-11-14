# Help: Place the gates

## If you get stuck

| What you see                             | Fix                                                             |
| ---------------------------------------- | --------------------------------------------------------------- |
| `FAIL every tier-high tool has a gate`   | Add the tool's name to a gate's `tools:` list.                  |
| `FAIL no gate proceeds on timeout ...`   | Set `on_timeout: wait`. A storm desk can wait ten more minutes. |
| `FAIL gates per desk lead per shift ...` | Fire the gate per `outage`, not per `report`.                   |
| `FAIL a gate covers rule P3 ...`         | Add a gate whose trigger says "a critical customer ...".        |

## Words you will use

- **Gate**: a stop where a person must answer before the action runs.
- **Trigger**: the event that makes a gate fire.
- **Timeout**: what happens when nobody answers before the deadline.
- **Escalate**: pass the gate to the next person up, such as the duty manager.
- **Approval fatigue**: people stop reading prompts when they see too many, and click yes.
