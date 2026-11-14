import type { Rule } from "../scripts/verify";
import { asList, block, designData, isFilled, readDesign, wordCount } from "./lib/design";
import { type Tool, toolsOf } from "./scope-the-tools";

// One row in the Threats block. A learner may leave any field out.
type Threat = {
  threat?: unknown;
  kind?: unknown;
  entersThrough?: unknown;
  reaches?: unknown;
  control?: unknown;
  controlKind?: unknown;
  gate?: unknown;
};

const THREATS_FILE = "threats.md";
const FEWEST_ROWS = 4;

// The three ways an agent gets turned against its owner.
export const THREAT_KINDS = ["prompt-injection", "too-much-power", "data-leak"];
export const CONTROL_KINDS = ["gate", "tier", "cap", "allowlist", "check"];

// A hope, not a control: asking the model to behave is not a fence.
const HOPEFUL =
  /tell the model|prompt (says|asks)|be careful|trust the model|model will (refuse|know)/i;

const threatsOf = (folder: string) =>
  asList<Threat>(designData<{ threats?: unknown }>(folder, "Threats", THREATS_FILE)?.threats);

const gateIdsOf = (folder: string) =>
  asList<{ gate?: unknown }>(designData<{ gates?: unknown }>(folder, "Gates")?.gates).map((row) =>
    String(row.gate),
  );

const toolNamed = (folder: string, name: unknown): Tool | undefined =>
  toolsOf(folder).find((tool) => tool.name === name);

function rowIsComplete(row: Threat): boolean {
  const filled = isFilled(row.threat) && isFilled(row.entersThrough) && isFilled(row.reaches);
  return filled && THREAT_KINDS.includes(String(row.kind)) && wordCount(row.control) >= 5;
}

// A threat that reaches a tool the design marks tier high needs a gate that exists in Gates.
function highToolHasGate(folder: string, row: Threat): boolean {
  const tool = toolNamed(folder, row.reaches);
  if (tool?.tier !== "high") return true;
  return row.controlKind === "gate" && gateIdsOf(folder).includes(String(row.gate));
}

export default [
  {
    says: "threats.md has a Threats section with a yaml design block",
    test: (folder) => block(readDesign(folder, THREATS_FILE), "Threats").ok,
    tryNext:
      "fill the yaml design block under ## Threats in threats.md; " +
      "keep the fence line ```yaml design",
  },
  {
    says: "four threats or more, each with a kind, an entry, a target tool and a control",
    test: (folder) => {
      const rows = threatsOf(folder);
      return rows.length >= FEWEST_ROWS && rows.every(rowIsComplete);
    },
    tryNext:
      "give each row threat:, kind:, enters_through:, reaches: " +
      "and a control: of at least 5 words; " +
      "write four rows or more",
  },
  {
    says: "there is one threat of each of the three kinds",
    test: (folder) => {
      const kinds = threatsOf(folder).map((row) => String(row.kind));
      return THREAT_KINDS.every((kind) => kinds.includes(kind));
    },
    tryNext: `use each kind at least once: ${THREAT_KINDS.join(", ")}`,
  },
  {
    says: "every threat reaches a tool that is in the Tools section of design.md",
    test: (folder) => {
      const rows = threatsOf(folder);
      return rows.length > 0 && rows.every((row) => toolNamed(folder, row.reaches) !== undefined);
    },
    tryNext: "set reaches: to the exact name of a tool in design.md, such as notify_customers",
  },
  {
    says: "every threat that reaches a tier high tool is held by a gate from the Gates section",
    test: (folder) => {
      const rows = threatsOf(folder);
      return rows.length > 0 && rows.every((row) => highToolHasGate(folder, row));
    },
    tryNext:
      "for a threat that reaches a tier high tool, set control_kind: gate " +
      "and gate: to the id of a gate in design.md",
  },
  {
    says: "every control is a fence the code holds, never a request to the model",
    test: (folder) => {
      const rows = threatsOf(folder);
      const kindsOk = rows.every((row) => CONTROL_KINDS.includes(String(row.controlKind)));
      return rows.length > 0 && kindsOk && rows.every((row) => !HOPEFUL.test(String(row.control)));
    },
    tryNext:
      `set control_kind: to one of ${CONTROL_KINDS.join(", ")}; ` +
      "a gate, a tier or a cap holds even when the model is fooled, a polite prompt does not",
  },
] satisfies Rule[];
