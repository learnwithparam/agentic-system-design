import type { Rule } from "../scripts/verify";
import { asList, block, designData, isFilled, readDesign } from "./lib/design";
import { readDesk, recordTables } from "./lib/world";
import { singular, type Tool, toolsOf, verbAndObject } from "./scope-the-tools";

// One fact in the Memory block. A learner may leave any field out, so every field is optional.
type Fact = {
  fact?: unknown;
  layer?: unknown;
  writer?: unknown;
  reader?: unknown;
  expires?: unknown;
};
type Memory = { contextCapTokens?: unknown; facts?: unknown };
type Outcome = { systemOfRecord?: { records?: unknown } };

export const LAYERS = ["context", "run-state", "notes", "system-of-record"];

// A person or a machine reads the context on every call, so the cap stays well under a prompt
// that a fast model handles at its list price: 100,000 tokens (config/models.ts).
const LARGEST_CONTEXT_CAP = 100000;

const memoryOf = (folder: string) => designData<Memory>(folder, "Memory") ?? {};
const factsOf = (folder: string) => asList<Fact>(memoryOf(folder).facts);

// "meter_reads" becomes [meter, read], so it matches a fact called "meter reads".
const wordsOf = (text: unknown) =>
  String(text ?? "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)
    .map(singular);

// A fact holds a thing when every word of the thing is in the fact's name.
function factHolds(fact: Fact, thing: string): boolean {
  const factWords = wordsOf(fact.fact);
  return wordsOf(thing).every((word) => factWords.includes(word));
}

// Every record the Outcome names and every object a tool acts on, such as outage or crew.
function thingsToPlace(folder: string): string[] {
  const outcome = designData<Outcome>(folder, "Outcome") ?? {};
  const records = asList<unknown>(outcome.systemOfRecord?.records).map(String);
  const objects = toolsOf(folder).map((tool: Tool) => verbAndObject(String(tool.name)).object);
  return [...new Set([...records, ...objects])];
}

function hasEveryField(fact: Fact): boolean {
  const filled = [fact.fact, fact.writer, fact.reader, fact.expires].every(isFilled);
  return filled && LAYERS.includes(String(fact.layer));
}

const isNote = (fact: Fact) => fact.layer === "notes";

// Jobs on the desk and tools in the design: the only things that can write or read a note.
async function knownWritersAndReaders(folder: string): Promise<string[]> {
  const jobs = (await readDesk()).jobs.map((job) => job.id);
  const tools = toolsOf(folder).map((tool) => String(tool.name));
  return [...jobs, ...tools];
}

function capIsSet(folder: string): boolean {
  const cap = memoryOf(folder).contextCapTokens;
  const largestToolCap = Math.max(
    0,
    ...toolsOf(folder).map((tool) => Number(tool.responseCapTokens) || 0),
  );
  if (typeof cap !== "number") return false;
  return cap >= largestToolCap && cap > 0 && cap <= LARGEST_CONTEXT_CAP;
}

export default [
  {
    says: "design.md has a Memory section with a yaml design block, after Outcome and Tools",
    test: (folder) => {
      const design = readDesign(folder);
      const names = ["Outcome", "Tools", "Memory"];
      return names.every((name) => block(design, name).ok);
    },
    tryNext: "keep your Outcome and Tools sections and fill the yaml design block under ## Memory",
  },
  {
    says: "every fact has a layer from the list, a writer, a reader and an expiry",
    test: (folder) => {
      const facts = factsOf(folder);
      return facts.length > 0 && facts.every(hasEveryField);
    },
    tryNext:
      "give each fact a layer (context, run-state, notes or system-of-record), " +
      "a writer:, a reader: and an expires: such as end of the run",
  },
  {
    says: "every record in Outcome and every object a tool acts on has a layer",
    test: (folder) => {
      const facts = factsOf(folder);
      const things = thingsToPlace(folder);
      return (
        things.length > 0 && things.every((thing) => facts.some((fact) => factHolds(fact, thing)))
      );
    },
    tryNext:
      "add a fact for each record in your Outcome (such as outages and calls) " +
      "and each tool object (such as crew and meter), named after it",
  },
  {
    says: "no long-term note holds a record the OMS owns",
    test: (folder) => {
      const notes = factsOf(folder).filter(isNote);
      const tables = recordTables();
      return notes.every((note) => !tables.some((table) => factHolds(note, table)));
    },
    tryNext:
      "the OMS already keeps outages, crews, customers and meter reads; " +
      "put them in the system-of-record layer and keep notes for what the OMS does not hold",
  },
  {
    says: "every long-term note has a writer and a reader that are jobs or tools in the design",
    test: async (folder) => {
      const known = await knownWritersAndReaders(folder);
      const notes = factsOf(folder).filter(isNote);
      const named = (value: unknown) => known.includes(String(value));
      return notes.every((note) => named(note.writer) && named(note.reader));
    },
    tryNext:
      "a note nobody reads is waste; set writer: and reader: to a job id " +
      "such as plan-the-crews, or a tool name from your Tools section",
  },
  {
    says: "the injected context has a cap in tokens, at least the largest tool response",
    test: capIsSet,
    tryNext:
      "set context_cap_tokens: to a number up to 100000 " +
      "that is at least as big as your largest response_cap_tokens",
  },
] satisfies Rule[];
