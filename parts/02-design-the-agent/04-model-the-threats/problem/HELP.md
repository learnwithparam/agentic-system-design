# Help: Model the threats

## If you get stuck

| What you see                                     | Fix                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| `FAIL every threat reaches a tool ...`           | Copy the tool name from `design.md`, such as `crew_assign`.           |
| `FAIL every threat that reaches a tier high ...` | Set `control_kind: gate` and `gate:` to an id from the Gates section. |
| `FAIL every control is a fence ...`              | Replace "tell the model" with a gate, a tier, a cap or an allowlist.  |

## Words you will use

- **Prompt injection**: hidden orders inside text that the model reads.
- **Too much power**: a tool that can do more than its job needs.
- **Data leak**: private facts that travel where they should not.
- **Allowlist**: a short list of the only values a tool accepts.
