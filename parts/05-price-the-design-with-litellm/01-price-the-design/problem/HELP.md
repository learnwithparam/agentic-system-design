# Help: Price the design

## If you get stuck

| What you see                                    | Fix                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `FAIL every price cell names a model key`       | Copy the key exactly from the cost map, and write `1.109.1`.       |
| `FAIL the recomputed monthly cost is filled in` | Check the cached tokens use the cached price, not the input price. |
| The gap is not zero                             | You may have picked a similar key. Compare its cached input price. |

## Words you will use

- **Cost map**: LiteLLM's list of the price per token of each model.
- **Model key**: the name a model has in the cost map.
- **Cached input**: input the model read before. Its price is lower than fresh input.
- **Gap**: the difference between your hand estimate and the cost map figure.

## Options

Choose the provider's own pricing page when only one provider is in play.

- Choose when: you use one provider and read its page each time you plan.
- Trade-off: no single source across providers, so you compare pages by hand.
