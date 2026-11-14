# Help: Plan the evals before a release

## If you get stuck

| What you see                                     | Fix                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| `FAIL a model grader is checked by a person ...` | Add `checked_by_person: 10` under the eval that uses `grader: model`. |
| `FAIL each pass mark is above 0 ...`             | A pass mark of 0 lets everything through. Use a share such as 0.9.    |
| `FAIL the evals cover every hard rule ...`       | Add the rule names to the crew plan eval, as in the sample.           |

## Words you will use

- **Eval**: a set of cases and a grader that scores how well a job is done.
- **Grader**: the code, model or person that scores one case.
- **Pass mark**: the lowest score that still lets a release go out.
- **Gate**: a rule that stops a release when an eval falls below its pass mark.
