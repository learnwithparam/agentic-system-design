import type { Rule } from "../scripts/verify";
import { asList, block, designData, isFilled, readDesign, wordCount } from "./lib/design";
import { isAgentRung } from "./lib/ladder";

// One tool in the Tools block. A learner may leave any field out, so every field is optional.
export type Tool = {
  name?: unknown;
  job?: unknown;
  action?: unknown;
  reversible?: unknown;
  impact?: unknown;
  tier?: unknown;
  responseCapTokens?: unknown;
  errorFormat?: unknown;
};

type ShapeJob = { job?: unknown; rung?: unknown };

export const ACTIONS = ["read", "write"];
export const IMPACTS = ["none", "money", "safety"];
export const TIERS = ["low", "medium", "high"];
export const NAMESPACES = ["oms", "crew", "notify"];

// Anthropic's "Writing effective tools for agents" (read 13 Nov 2026) caps a tool response
// at 25,000 tokens by default. A design may set a smaller cap, never a larger one.
export const LARGEST_RESPONSE_CAP = 25000;

// Words that mean the same action. Two tools with the same action on the same object overlap.
const SAME_ACTION: Record<string, string> = {
  read: "read",
  get: "read",
  fetch: "read",
  list: "read",
  look: "read",
  find: "read",
  send: "send",
  notify: "send",
  text: "send",
  message: "send",
  tell: "send",
  close: "close",
  resolve: "close",
  finish: "close",
  end: "close",
  assign: "assign",
  dispatch: "assign",
  open: "open",
  create: "open",
  add: "open",
  update: "update",
  edit: "update",
  change: "update",
  set: "update",
};

export const toolsOf = (folder: string) =>
  asList<Tool>(designData<{ tools?: unknown }>(folder, "Tools")?.tools);

export const isWriteTool = (tool: Tool) => tool.action === "write";

// "outages" and "outage" are the same object, so each word loses a plural s.
export const singular = (word: string) => word.replace(/s$/, "");

export type VerbAndObject = { verb: string; object: string };

// oms_close_outage is close + outage. crew_assign is assign + crew.
// notify_customers is send + customer, because notify is a word for send.
export function verbAndObject(name: string): VerbAndObject {
  const words = name.toLowerCase().split("_");
  const namespace = words[0];
  const verbWord = words.find((word) => word in SAME_ACTION) ?? words[1] ?? "";
  const objectWords = words.slice(1).filter((word) => word !== verbWord);
  const object = objectWords.length > 0 ? objectWords.join("_") : namespace;
  const verb = SAME_ACTION[verbWord] ?? verbWord;
  return { verb, object: singular(object) };
}

function hasEveryField(tool: Tool): boolean {
  const cap = tool.responseCapTokens;
  const capFits = typeof cap === "number" && cap > 0 && cap <= LARGEST_RESPONSE_CAP;
  return (
    isFilled(tool.name) &&
    isFilled(tool.job) &&
    ACTIONS.includes(String(tool.action)) &&
    typeof tool.reversible === "boolean" &&
    IMPACTS.includes(String(tool.impact)) &&
    TIERS.includes(String(tool.tier)) &&
    capFits &&
    wordCount(tool.errorFormat) >= 8
  );
}

// A write that cannot be undone is always tier high. Every other tool passes.
function irreversibleIsHigh(tool: Tool): boolean {
  const cannotUndo = isWriteTool(tool) && tool.reversible === false;
  return !cannotUndo || tool.tier === "high";
}

const NAME_SHAPE = new RegExp(`^(${NAMESPACES.join("|")})_[a-z]+(_[a-z]+)*$`);

function noTwoToolsOverlap(tools: Tool[]): boolean {
  const seen = new Set<string>();
  for (const tool of tools) {
    const { verb, object } = verbAndObject(String(tool.name));
    const pair = `${verb} ${object}`;
    if (seen.has(pair)) return false;
    seen.add(pair);
  }
  return true;
}

// The jobs a tool may belong to: jobs on the workflow, agent or many-agents rung in Shape.
function jobsThatHoldTools(folder: string): string[] {
  const jobs = asList<ShapeJob>(designData<{ jobs?: unknown }>(folder, "Shape")?.jobs);
  const holders = jobs.filter((job) => job.rung === "workflow" || isAgentRung(job.rung));
  return holders.map((job) => String(job.job));
}

// True when the Tools block lists at least one tool and every tool passes the test.
function everyTool(folder: string, passes: (tool: Tool) => boolean): boolean {
  const tools = toolsOf(folder);
  return tools.length > 0 && tools.every(passes);
}

export default [
  {
    says: "design.md has a Tools section with a yaml design block, after a Shape section",
    test: (folder) => {
      const design = readDesign(folder);
      return block(design, "Shape").ok && block(design, "Tools").ok;
    },
    tryNext:
      "keep the sections from part one and fill the yaml design block under ## Tools; " +
      "keep the fence line ```yaml design",
  },
  {
    says: "every tool has every field, with a response cap of 25,000 tokens or less",
    test: (folder) => everyTool(folder, hasEveryField),
    tryNext:
      "give each tool name, job, action (read or write), reversible (true or false), " +
      "impact (none, money or safety), tier (low, medium or high), " +
      "response_cap_tokens (a number up to 25000) and an error_format of at least 8 words",
  },
  {
    says: "the agent has at least one read tool and one write tool",
    test: (folder) => {
      const tools = toolsOf(folder);
      const reads = tools.some((tool) => tool.action === "read");
      return reads && tools.some(isWriteTool);
    },
    tryNext:
      "add a tool that only looks, such as oms_read_meters, " +
      "and one that changes something, such as crew_assign",
  },
  {
    says: "every write that cannot be undone is tier high",
    test: (folder) => everyTool(folder, irreversibleIsHigh),
    tryNext:
      "a text that reached a phone or a closed outage cannot be undone; " +
      "set tier: high on every write tool with reversible: false",
  },
  {
    says: "every tool name starts with oms_, crew_ or notify_",
    test: (folder) => everyTool(folder, (tool) => NAME_SHAPE.test(String(tool.name))),
    tryNext:
      "name each tool namespace_verb_object in lower case, " +
      "such as oms_close_outage, crew_assign or notify_customers",
  },
  {
    says: "no two tools do the same action on the same object",
    test: (folder) => noTwoToolsOverlap(toolsOf(folder)),
    tryNext:
      "two tools such as oms_read_outage and oms_get_outage confuse the model; " +
      "keep one of them and delete the other",
  },
  {
    says: "every tool belongs to a job on the workflow or agent rung in Shape",
    test: (folder) => {
      const holders = jobsThatHoldTools(folder);
      return everyTool(folder, (tool) => holders.includes(String(tool.job)));
    },
    tryNext:
      "set job: to a job your Shape section puts on the workflow or agent rung; " +
      "a person's job, such as switch-the-feeder, holds no tool",
  },
] satisfies Rule[];
