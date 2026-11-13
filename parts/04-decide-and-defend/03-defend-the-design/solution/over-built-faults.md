# The five faults in the over-built design

These are the answers for the Go further task in `examples/over-built.md`.

1. **Shape**: `switch-the-feeder` sits on the agent rung. Rule P1 says only a switching engineer operates a
   switch. The `place-on-the-ladder` check rejects it.
2. **Shape**: `group-the-reports` uses many agents. Each report follows the same steps, so a workflow is
   enough. Many agents use about 15 times the tokens of a chat.
3. **Tools**: `oms_close_outage` cannot be undone, but its tier is medium. The `scope-the-tools` check wants
   tier high.
4. **Memory**: outages are kept as long-term notes, a second source of truth next to the OMS. The
   `map-the-memory` check rejects it.
5. **Restart**: the key `outage:uuid` is new on every try, so a restart sends a second crew. For example,
   `OUT-005` could get two crews.
