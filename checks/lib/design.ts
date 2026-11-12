// Reading a design doc. A section is a "## Name" heading; its data is the first fenced block tagged
// "yaml design" under it. Prose is for people, the block is for the checks.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const read = (dir: string, file = "design.md"): string | null => {
  const p = join(dir, file);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
};

export function section(text: string | null, name: string): string | null {
  if (!text) return null;
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${name}`.toLowerCase());
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (/^## /.test(lines[i])) { end = i; break; }
  return lines.slice(start + 1, end).join("\n");
}

export type Block = { ok: true; data: any } | { ok: false; error: string };
export function block(text: string | null, name: string): Block {
  const s = section(text, name);
  if (s === null) return { ok: false, error: `no "## ${name}" heading` };
  const m = s.match(/```yaml design\n([\s\S]*?)```/);
  if (!m) return { ok: false, error: `no yaml design block under "## ${name}"` };
  try {
    const data = Bun.YAML.parse(m[1]);
    if (data === null || typeof data !== "object") return { ok: false, error: "the block is empty" };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: `the block is not valid YAML: ${(e as Error).message}` };
  }
}

// Read a block for a rule: undefined when it is missing or broken (the rule then fails).
export const data = (dir: string, name: string, file = "design.md") => {
  const b = block(read(dir, file), name);
  return b.ok ? b.data : undefined;
};

export const filled = (v: unknown): boolean =>
  v !== null && v !== undefined && !(typeof v === "string" && (v.trim() === "" || /^(todo|tbd|\?+|\.\.\.)$/i.test(v.trim())));

export const words = (v: unknown) => (typeof v === "string" ? v.trim().split(/\s+/).filter(Boolean).length : 0);

export const list = (v: unknown): any[] => (Array.isArray(v) ? v : []);

// "45 minutes" or 45 with a unit field. Returns the number and the unit, or null.
export function amount(v: unknown, unitField?: unknown): { n: number; unit: string } | null {
  if (typeof v === "number" && typeof unitField === "string" && unitField.trim()) return { n: v, unit: unitField.trim() };
  if (typeof v === "string") {
    const m = v.trim().match(/^(-?\d+(?:\.\d+)?)\s*(%|[A-Za-z][A-Za-z ]*)$/);
    if (m) return { n: Number(m[1]), unit: m[2].trim() };
  }
  return null;
}
