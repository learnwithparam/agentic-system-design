import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { type Adr, adrs, MADR_STATUS, missingHeadings } from "./lib/adr";
import { readDesign, section } from "./lib/design";

const FEWEST_ADRS = 3;

// Every step of the course, from PARTS.md. A Confirmation names one of these checks.
// The list is fixed, so an ADR may name a check from a part that is still being built.
export const COURSE_STEPS = [
  "meet-the-outage-desk",
  "place-on-the-ladder",
  "write-the-outcome",
  "pick-the-pattern",
  "scope-the-tools",
  "map-the-memory",
  "place-the-gates",
  "name-the-failures",
  "design-the-restart",
  "price-the-outcome",
  "record-the-decisions",
  "review-a-real-system",
  "defend-the-design",
];

// A link from an ADR to what it decides: ../design.md#gates or ../cost.yaml.
const DESIGN_LINK = /\]\((?:\.\.\/)?design\.md#([a-z0-9-]+)\)/g;
const COST_LINK = /\]\((?:\.\.\/)?cost\.yaml\)/;

// The design sections each ADR links to, such as "gates", plus "cost" for a link to cost.yaml.
export function linkedSections(adr: Adr): string[] {
  const sections = [...adr.text.matchAll(DESIGN_LINK)].map((match) => match[1]);
  if (COST_LINK.test(adr.text)) sections.push("cost");
  return sections;
}

// A link is real when design.md has that heading, or when cost.yaml sits next to it.
function linkIsReal(folder: string, linked: string): boolean {
  if (linked === "cost") return existsSync(join(folder, "cost.yaml"));
  const heading = linked.replace(/-/g, " ");
  return section(readDesign(folder), heading) !== null;
}

// The Confirmation names a step whose check proves the decision, such as place-the-gates.
function confirmationNamesCheck(adr: Adr): boolean {
  return COURSE_STEPS.some((name) => adr.confirmation.includes(name));
}

// True when the folder has at least three ADRs and every one passes the test.
function everyAdr(folder: string, passes: (adr: Adr) => boolean): boolean {
  const records = adrs(folder);
  return records.length >= FEWEST_ADRS && records.every(passes);
}

export default [
  {
    says: "adr/ holds at least three ADRs named like 0001-short-title.md",
    test: (folder) => adrs(folder).length >= FEWEST_ADRS,
    tryNext:
      "write three files in adr/: 0001-, 0002- and 0003- followed by a short title in " +
      "lower case words joined by dashes, ending in .md",
  },
  {
    says: "every ADR has the MADR headings, Confirmation included",
    test: (folder) => everyAdr(folder, (adr) => missingHeadings(adr).length === 0),
    tryNext:
      "keep the headings of the template: Context and Problem Statement, Considered Options, " +
      "Decision Outcome, Consequences and Confirmation",
  },
  {
    says: "every status is one from the MADR list",
    test: (folder) => everyAdr(folder, (adr) => MADR_STATUS.includes(String(adr.status))),
    tryNext: `set status: in the front matter to one of ${MADR_STATUS.join(", ")}`,
  },
  {
    says: "every ADR weighs at least two options",
    test: (folder) => everyAdr(folder, (adr) => adr.options.length >= 2),
    tryNext:
      "list the option you chose and at least one you turned down as bullets " +
      "under ## Considered Options",
  },
  {
    says: "every ADR names at least one bad consequence",
    test: (folder) => everyAdr(folder, (adr) => adr.badConsequences >= 1),
    tryNext:
      "every choice costs something; add a bullet that starts with Bad, under ### Consequences",
  },
  {
    says: "every Confirmation names the step whose check proves the decision",
    test: (folder) => everyAdr(folder, confirmationNamesCheck),
    tryNext: "under ### Confirmation, name the check, such as bun run verify place-the-gates",
  },
  {
    says: "every ADR links to the design section or cost.yaml it decides, and the link is real",
    test: (folder) =>
      everyAdr(folder, (adr) => {
        const links = linkedSections(adr);
        return links.length > 0 && links.every((linked) => linkIsReal(folder, linked));
      }),
    tryNext:
      "link each ADR to what it decides, such as [Gates](../design.md#gates) " +
      "or [cost](../cost.yaml)",
  },
  {
    says: "between them, the ADRs decide the shape, a gate and the cost",
    test: (folder) => {
      const linked = adrs(folder).flatMap(linkedSections);
      const decidesShape = linked.includes("shape") || linked.includes("pattern");
      return decidesShape && linked.includes("gates") && linked.includes("cost");
    },
    tryNext:
      "write one ADR that links to ../design.md#shape, one to ../design.md#gates " +
      "and one to ../cost.yaml",
  },
] satisfies Rule[];
