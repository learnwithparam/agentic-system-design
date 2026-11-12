import { expect, test } from "bun:test";
import { missingHeadings, parse } from "../checks/lib/adr";
import { costPerOutcome } from "../checks/lib/cost";
import { amount, block, section } from "../checks/lib/design";

const designDoc = [
  "# D",
  "",
  "## Shape",
  "",
  "text",
  "",
  "```yaml design",
  "jobs:",
  "  - job: a",
  "    rung: workflow",
  "```",
  "",
  "## Outcome",
  "",
  "none",
  "",
].join("\n");

test("a section and its yaml design block are read", () => {
  expect(section(designDoc, "Shape")).toContain("text");
  const shape = block(designDoc, "Shape");
  const jobs = shape.ok ? (shape.data.jobs as { rung: string }[]) : [];
  expect(jobs[0].rung).toBe("workflow");
  expect(block(designDoc, "Outcome").ok).toBe(false);
  expect(block(designDoc, "Pattern").ok).toBe(false);
});

test("amounts need a number and a unit", () => {
  expect(amount("20 minutes")).toEqual({ value: 20, unit: "minutes" });
  expect(amount("soon")).toBeNull();
  expect(amount(45, "minutes")).toEqual({ value: 45, unit: "minutes" });
});

const adrText = [
  "---",
  "status: accepted",
  "---",
  "# Use a workflow",
  "",
  "## Context and Problem Statement",
  "",
  "x",
  "",
  "## Considered Options",
  "",
  "* A",
  "* B",
  "",
  "## Decision Outcome",
  "",
  "A",
  "",
  "### Consequences",
  "",
  "* Good, because x",
  "* Bad, because y",
  "",
  "### Confirmation",
  "",
  "The check place-on-the-ladder.",
  "",
].join("\n");

test("an ADR in MADR form is parsed, with Confirmation required", () => {
  const adr = parse("0001-x.md", adrText);
  expect(adr.status).toBe("accepted");
  expect(adr.options.length).toBe(2);
  expect(adr.badConsequences).toBe(1);
  expect(missingHeadings(adr)).toEqual([]);
});

test("cost per outcome uses the list prices", () => {
  const oneMillionFreshTokens = {
    job: "x",
    role: "fast" as const,
    callsPerOutcome: 1,
    inputTokens: 1_000_000,
    cachedInputTokens: 0,
    outputTokens: 0,
  };
  expect(costPerOutcome([oneMillionFreshTokens])).toBeCloseTo(0.1, 6);
});
