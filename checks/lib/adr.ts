// Reading an ADR (an architecture decision record) in MADR 4.0.0 form: https://github.com/adr/madr.
// MADR marks the Confirmation section optional. This course requires it,
// so every decision names how it will be checked.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const MADR_STATUS = ["proposed", "rejected", "accepted", "deprecated", "superseded"];
export const MADR_HEADINGS = [
  "## Context and Problem Statement",
  "## Considered Options",
  "## Decision Outcome",
  "### Consequences",
  "### Confirmation",
];

export type Adr = {
  file: string;
  status: string | null;
  title: string | null;
  text: string;
  options: string[];
  badConsequences: number;
  confirmation: string;
};

// Every ADR in the folder, such as adr/0001-use-a-workflow.md, in file order.
export function adrs(folder: string, adrFolder = "adr"): Adr[] {
  const path = join(folder, adrFolder);
  if (!existsSync(path)) return [];
  const files = readdirSync(path).filter((file) => /^\d{4}-[a-z0-9-]+\.md$/.test(file));
  return files.sort().map((file) => parse(file, readFileSync(join(path, file), "utf8")));
}

// The text under a heading, up to the next heading of the same level or higher.
function textUnder(text: string, heading: string): string {
  const start = text.indexOf(`${heading}\n`);
  if (start < 0) return "";
  const rest = text.slice(start + heading.length + 1);
  const level = heading.match(/^#+/)?.[0].length ?? 1;
  const next = rest.search(new RegExp(`^#{1,${level}} `, "m"));
  return next < 0 ? rest : rest.slice(0, next);
}

// The status from the front matter between the --- lines, or null.
function statusOf(text: string): string | null {
  const frontMatter = text.match(/^---\n([\s\S]*?)\n---/);
  if (!frontMatter) return null;
  try {
    const fields = Bun.YAML.parse(frontMatter[1]) as { status?: unknown } | null;
    return String(fields?.status ?? "") || null;
  } catch {
    return null;
  }
}

export function parse(file: string, text: string): Adr {
  const optionLines = textUnder(text, "## Considered Options").split("\n");
  const consequences = textUnder(text, "### Consequences");
  return {
    file,
    status: statusOf(text),
    title: text.match(/^# (.+)$/m)?.[1] ?? null,
    text,
    options: optionLines.filter((line) => /^\s*[-*] /.test(line)),
    badConsequences: (consequences.match(/^\s*[-*] Bad, /gm) ?? []).length,
    confirmation: textUnder(text, "### Confirmation").trim(),
  };
}

export const missingHeadings = (adr: Adr) =>
  MADR_HEADINGS.filter((heading) => !adr.text.includes(`${heading}\n`));
