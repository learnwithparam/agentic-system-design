// Reading an ADR in MADR 4.0.0 form (https://github.com/adr/madr). This course requires the Confirmation
// section, which MADR marks optional, so every decision names how it will be checked.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const MADR_STATUS = ["proposed", "rejected", "accepted", "deprecated", "superseded"];
export const MADR_HEADINGS = ["## Context and Problem Statement", "## Considered Options", "## Decision Outcome", "### Consequences", "### Confirmation"];

export type Adr = { file: string; status: string | null; title: string | null; text: string; options: string[]; bad: number; confirmation: string };

export function adrs(dir: string, folder = "adr"): Adr[] {
  const d = join(dir, folder);
  if (!existsSync(d)) return [];
  return readdirSync(d)
    .filter((f) => /^\d{4}-[a-z0-9-]+\.md$/.test(f))
    .sort()
    .map((f) => parse(f, readFileSync(join(d, f), "utf8")));
}

const part = (text: string, heading: string) => {
  const i = text.indexOf(heading + "\n");
  if (i < 0) return "";
  const rest = text.slice(i + heading.length + 1);
  const level = heading.match(/^#+/)![0].length;
  const next = rest.search(new RegExp(`^#{1,${level}} `, "m"));
  return next < 0 ? rest : rest.slice(0, next);
};

export function parse(file: string, text: string): Adr {
  const front = text.match(/^---\n([\s\S]*?)\n---/);
  let status: string | null = null;
  if (front) {
    try { status = String((Bun.YAML.parse(front[1]) as any)?.status ?? "") || null; } catch { status = null; }
  }
  return {
    file,
    status,
    title: text.match(/^# (.+)$/m)?.[1] ?? null,
    text,
    options: part(text, "## Considered Options").split("\n").filter((l) => /^\s*[-*] /.test(l)),
    bad: (part(text, "### Consequences").match(/^\s*[-*] Bad, /gm) ?? []).length,
    confirmation: part(text, "### Confirmation").trim(),
  };
}

export const missingHeadings = (a: Adr) => MADR_HEADINGS.filter((h) => !a.text.includes(h + "\n"));
