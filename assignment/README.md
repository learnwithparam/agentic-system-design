# Assignment: price your design with LiteLLM

This is optional in the live session and expected as homework. It takes about 15 minutes.

## The task

Recompute your design's monthly model cost from the LiteLLM cost map. The sheet `assignment/sheet.csv`
lists the model calls of the sample design and the hand estimate for a storm month. Fill the model key, the
LiteLLM version and the recomputed cost on every row. The steps are in
[the part page](../parts/05-price-the-design-with-litellm/README.md).

This assignment needs no Docker and no model key. The cost map is a file in `config/`.

## Done when

The script checks these two lines.

- Every price cell names a model key from the cost map and the LiteLLM version.
- The recomputed monthly cost is filled in and matches the prices of that key.

```bash
bun assignment/check.ts
```

Expect: `PASS` or `FAIL` for each line, and a file `assignment/result.json`.

## Rubric

A person reads this line.

- Any gap between the hand estimate and the cost map figure is explained in one sentence.

## Hand it in

Push a branch named `assignment` and send its URL. The grader runs the same script.
