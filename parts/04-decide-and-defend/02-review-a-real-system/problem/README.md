# Review a real system

## The problem

Teams copy what they read in customer stories. But a story is written to sell. A reviewer reads it the way a
doctor reads a test result: what was measured, against what base, and who checked it?

For example, the AES story says "96% faster" for audit results. The same page says "Reduced audit costs by
99%". Faster than what? 99% of which costs? The page does not say. So a reviewer marks that item "not
stated" and asks the team.

You review one real system with the same checklist your own design must pass. Its saved page is in
`../cases/`.

```mermaid
flowchart LR
  P[saved page in cases/] --> I[each checklist item]
  I -->|the page says it| Q[pass, with a quote]
  I -->|the page says the opposite| F[fail]
  I -->|the page is silent| N[not-stated]
  Q --> A[one question for the team]
  N --> A
```

## Your challenge

Pick one case: `freedom-forever` or `aes`. Rename `review-freedom-forever.md` to match it, such as
`review-aes.md`. Under `## Review`, set `case:` and answer each item:

| Item               | The question                                               |
| ------------------ | ---------------------------------------------------------- |
| `outcome`          | Does it name the result, not only the activity?            |
| `metric-base`      | Does each headline number say what it is counted against?  |
| `shape`            | Does it say whether code or the model picks the next step? |
| `human-gate`       | Does it say where a person signs off before an action?     |
| `failure-path`     | Does it say what happens when the system is wrong?         |
| `cost-per-outcome` | Does it give a cost for one result?                        |
| `system-of-record` | Does it say where the truth is checked?                    |

Answer each with `pass`, `fail` or `not-stated`. A `pass` needs a `quote` of at least 5 words, copied from
the case file. Then write one `question` for the team about a denominator or a gate.

For example, the sample answer for Freedom Forever has:

```yaml
- item: cost-per-outcome
  answer: pass
  quote: Each execution costs $0.20–$0.35 and completes in about two minutes
```

Its question asks for the base: "Of the 19,000 emails, how many did a person check after the agent acted, and
how many of those were wrong?"

## Done when

- A `review-<case>.md` file has a Review block, and `case:` names a file in `cases/`.
- Every checklist item is answered once with `pass`, `fail` or `not-stated`.
- Every pass quotes at least 5 words found in the saved page.
- At least one item is `not-stated`.
- The question asks for a denominator or about a gate, in at least 8 words, and ends with `?`.

```bash
bun run verify review-a-real-system
```

Expect: `Done. All 5 rules pass.` and a `Progress:` line.

## If you get stuck

| What you see                                  | Fix                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| `FAIL every pass quotes at least 5 words ...` | Copy the words from the case file. If the page never says it, use `not-stated`. |
| `FAIL at least one item is not stated`        | Look again at `human-gate` and `system-of-record`.                              |
| `FAIL the question for the team asks ...`     | Ask "of how many?" or "who signs off before the agent acts?".                   |

## Words you will use

- **Vendor claim**: a number published by the company selling the product.
- **Denominator**: the number you divide by, the base of a percent.
- **Not stated**: the page is silent on this item. It is not a pass and not a fail.
