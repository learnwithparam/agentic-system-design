import { expect, test } from "bun:test";
import { amount, block, section } from "../checks/lib/design";
import { parse, missingHeadings } from "../checks/lib/adr";
import { costPerOutcome } from "../checks/lib/cost";

const doc = "# D\n\n## Shape\n\ntext\n\n```yaml design\njobs:\n  - job: a\n    rung: workflow\n```\n\n## Outcome\n\nnone\n";

test("a section and its yaml design block are read", () => {
  expect(section(doc, "Shape")).toContain("text");
  const b = block(doc, "Shape");
  expect(b.ok && b.data.jobs[0].rung).toBe("workflow");
  expect(block(doc, "Outcome").ok).toBe(false);
  expect(block(doc, "Pattern").ok).toBe(false);
});

test("amounts need a number and a unit", () => {
  expect(amount("20 minutes")).toEqual({ n: 20, unit: "minutes" });
  expect(amount("soon")).toBeNull();
  expect(amount(45, "minutes")).toEqual({ n: 45, unit: "minutes" });
});

test("an ADR in MADR form is parsed, with Confirmation required", () => {
  const a = parse("0001-x.md", "---\nstatus: accepted\n---\n# Use a workflow\n\n## Context and Problem Statement\n\nx\n\n## Considered Options\n\n* A\n* B\n\n## Decision Outcome\n\nA\n\n### Consequences\n\n* Good, because x\n* Bad, because y\n\n### Confirmation\n\nThe check place-on-the-ladder.\n");
  expect(a.status).toBe("accepted");
  expect(a.options.length).toBe(2);
  expect(a.bad).toBe(1);
  expect(missingHeadings(a)).toEqual([]);
});

test("cost per outcome uses the list prices", () => {
  const c = costPerOutcome([{ job: "x", role: "fast", calls_per_outcome: 1, input_tokens: 1_000_000, cached_input_tokens: 0, output_tokens: 0 }]);
  expect(c).toBeCloseTo(0.1, 6);
});
