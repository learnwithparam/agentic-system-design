# Help: Scope the tools

## If you get stuck

| What you see                                                     | Fix                                                                  |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| `FAIL every write that cannot be undone is tier high`            | Find each tool with `reversible: false`. Set its `tier: high`.       |
| `FAIL no two tools do the same action on the same object`        | `oms_read_outage` and `oms_get_outage` overlap. Keep one.            |
| `FAIL every tool belongs to a job on the workflow or agent rung` | `switch-the-feeder` is a person's job. A person's job holds no tool. |

## Words you will use

- **Read tool** only looks, such as `oms_read_meters`. A **write tool** changes something, such as `crew_assign`.
- **Reversible**: you can undo it. You can move a crew. You cannot unsend a text.
- **Risk tier**: how much harm a wrong call can do: low, medium or high.
- **Namespace**: the first word of a tool name, such as `oms_`.
- **Response cap**: the most tokens a tool may send back to the model in one reply.
