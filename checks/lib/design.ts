// Reading a design doc. A section is a "## Name" heading. Its data is the first fenced block
// tagged "yaml design" under it. The prose is for people; the block is for the checks.
// For example, a "## Shape" section holds a block with jobs: and one entry for each job.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { withCamelCaseNames } from "../../world/lib/field-names";

export function readDesign(folder: string, file = "design.md"): string | null {
  const path = join(folder, file);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

// The text under "## name", up to the next "## " heading. Null when the heading is missing.
export function section(text: string | null, name: string): string | null {
  if (!text) return null;
  const lines = text.split("\n");
  const heading = `## ${name}`.toLowerCase();
  const start = lines.findIndex((line) => line.trim().toLowerCase() === heading);
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n");
}

export type Block = { ok: true; data: Record<string, unknown> } | { ok: false; error: string };

// The yaml design block under a section, read into data, or the reason it could not be read.
export function block(text: string | null, name: string): Block {
  const sectionText = section(text, name);
  if (sectionText === null) return { ok: false, error: `no "## ${name}" heading` };
  const fenced = sectionText.match(/```yaml design\n([\s\S]*?)```/);
  if (!fenced) return { ok: false, error: `no yaml design block under "## ${name}"` };
  try {
    const data = Bun.YAML.parse(fenced[1]);
    if (data === null || typeof data !== "object")
      return { ok: false, error: "the block is empty" };
    return { ok: true, data: data as Record<string, unknown> };
  } catch (error) {
    return { ok: false, error: `the block is not valid YAML: ${(error as Error).message}` };
  }
}

// Read a block for a rule: undefined when it is missing or broken, and the rule then fails.
// The YAML uses snake_case names (decides_next_step); the code reads them as decidesNextStep.
export function designData<Shape>(folder: string, name: string, file = "design.md") {
  const result = block(readDesign(folder, file), name);
  return result.ok ? withCamelCaseNames<Shape>(result.data) : undefined;
}

// True when a value holds a real answer, not a blank or a placeholder such as TODO or "...".
export function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== "string") return true;
  const trimmed = value.trim();
  return trimmed !== "" && !/^(todo|tbd|\?+|\.\.\.)$/i.test(trimmed);
}

export function wordCount(value: unknown): number {
  if (typeof value !== "string") return 0;
  return value.trim().split(/\s+/).filter(Boolean).length;
}

// The value when it is a list, or an empty list for anything else.
export const asList = <Item>(value: unknown): Item[] => (Array.isArray(value) ? value : []);

export type Amount = { value: number; unit: string };

// "45 minutes", or 45 with a separate unit field. Returns the number and the unit, or null.
export function amount(value: unknown, unitField?: unknown): Amount | null {
  if (typeof value === "number" && typeof unitField === "string" && unitField.trim()) {
    return { value, unit: unitField.trim() };
  }
  if (typeof value !== "string") return null;
  const parts = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*(%|[A-Za-z][A-Za-z ]*)$/);
  if (!parts) return null;
  return { value: Number(parts[1]), unit: parts[2].trim() };
}
