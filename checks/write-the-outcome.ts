import type { Rule } from "../scripts/verify";
import { block, data, filled, list, read, words } from "./lib/design";
import { readDesk, recordTables } from "./lib/world";

const out = (d: string) => data(d, "Outcome") ?? {};
const nevers = (d: string) => list(out(d).must_never).map(String);
const covers = (text: string, keywords: string[]) => keywords.every((k) => new RegExp(k, "i").test(text));
const SELF_REPORT = /\b(agent|model|crew|system|bot)\s+(says|said|reports|reported|confirms|confirmed|marks|marked|thinks)\b|\bsays (it is|it's) (done|fixed)/i;

export default [
  {
    says: "design.md has an Outcome section with a yaml design block",
    test: (d) => block(read(d), "Outcome").ok,
    tryNext: "fill the yaml design block under ## Outcome in design.md; keep the fence line ```yaml design",
  },
  {
    says: "the outcome is a sentence of at least 8 words",
    test: (d) => filled(out(d).outcome) && words(out(d).outcome) >= 8,
    tryNext: "write outcome: as what a person at Copperbeck can see when the system works, in one sentence",
  },
  {
    says: "the metric has a name, a number and a unit",
    test: (d) => {
      const m = out(d).metric ?? {};
      return filled(m.name) && typeof m.target === "number" && Number.isFinite(m.target) && filled(m.unit);
    },
    tryNext: "set metric: name:, target: (a plain number such as 45) and unit: (such as minutes or percent)",
  },
  {
    says: "every must-never is a sentence with the word never",
    test: (d) => nevers(d).length > 0 && nevers(d).every((s) => /\bnever\b/i.test(s) && words(s) >= 6),
    tryNext: "write each must_never: line as The system never ..., naming one action",
  },
  {
    says: "the must-never covers at least one hard rule in the desk policy",
    test: async (d) => (await readDesk()).hard_rules.some((r) => nevers(d).some((s) => covers(s, r.keywords))),
    tryNext: "read world/policy.md: P2 (closing an outage) and P3 (critical customers) are the rules a machine could break",
  },
  {
    says: "the system of record is the OMS, and every record it names is a table in the OMS",
    test: async (d) => {
      const s = out(d).system_of_record ?? {};
      const recs = list(s.records).map(String);
      const t = recordTables();
      return s.name === (await readDesk()).system_of_record && recs.length > 0 && recs.every((r) => t.includes(r));
    },
    tryNext: `set system_of_record: name: oms and records: to tables in world/state/oms.db (${["outages", "meter_reads", "calls"].join(", ")} and others in world/README.md)`,
  },
  {
    says: "done is a check against OMS records, not anyone's word that it is done",
    test: (d) => {
      const dw = list(out(d).done_when);
      const t = recordTables();
      return dw.length > 0 && dw.every((x) => words(x?.check) >= 6 && !SELF_REPORT.test(String(x.check)) && list(x.reads).length > 0 && list(x.reads).every((r) => t.includes(String(r))));
    },
    tryNext: "write done_when: as a check: a person could run against the OMS tables it reads:, never the agent or crew saying it is done",
  },
] satisfies Rule[];
