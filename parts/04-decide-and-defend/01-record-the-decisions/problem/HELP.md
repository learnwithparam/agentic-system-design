# Help: Record the decisions

## If you get stuck

| What you see                                        | Fix                                                      |
| --------------------------------------------------- | -------------------------------------------------------- |
| `FAIL every ADR names at least one bad consequence` | Start a bullet with `Bad,` and say what gets worse.      |
| `FAIL every Confirmation names the step ...`        | Name a check such as `bun run verify price-the-outcome`. |
| `FAIL every ADR links to the design section ...`    | Write the link as `[Gates](../design.md#gates)`.         |
| `FAIL` lines after you add renamed files            | Delete the old empty files in `adr/`.                    |

## Words you will use

- **Considered options**: the choices you weighed, the winner and the ones you turned down.
- **Consequence**: what changes because of the choice, good or bad.
- **Confirmation**: how you will check that the choice was carried out.
