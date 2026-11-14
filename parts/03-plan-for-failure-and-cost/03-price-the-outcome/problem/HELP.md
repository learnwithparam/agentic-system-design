# Help: Price the outcome

## If you get stuck

| What you see                                              | Fix                                                               |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| `FAIL every job on a machine rung in Shape has a call`    | Add a call for `plan-the-crews` and `write-the-customer-updates`. |
| `FAIL ... within four times ...`                          | Count calls per outage, not per storm or per call.                |
| `FAIL the storm month ... stays under the monthly budget` | Raise the budget, or cut calls.                                   |

## Words you will use

- **Cost per outcome**: what you spend on model calls for one useful result.
- **Cached input**: input the model read before. In `config/models.ts` it costs a tenth (`fast`) to a twentieth (`smart`) of fresh input.
- **Role**: `fast` or `smart`. `config/models.ts` maps each role to a model and a price.
- **Value per outcome**: what one result is worth, such as desk time saved.
