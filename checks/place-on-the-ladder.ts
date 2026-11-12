import type { Rule } from "../scripts/verify";
import { block, data, filled, list, read, words, amount } from "./lib/design";
import { AGENT_REASONS, DECIDES, RUNGS, TRIGGERS, isAgentRung } from "./lib/ladder";
import { readDesk } from "./lib/world";

const jobs = (d: string) => list(data(d, "Shape")?.jobs);
const all = (d: string, f: (j: any) => boolean) => jobs(d).length > 0 && jobs(d).every(f);

export default [
  {
    says: "design.md has a Shape section with a yaml design block",
    test: (d) => block(read(d), "Shape").ok,
    tryNext: "open design.md in this folder and fill the yaml design block under ## Shape; keep the fence line ```yaml design",
  },
  {
    says: "every job on the desk appears exactly once, and no other job",
    test: async (d) => {
      const want = (await readDesk()).jobs.map((j) => j.id).sort();
      const got = jobs(d).map((j) => String(j.job)).sort();
      return JSON.stringify(want) === JSON.stringify(got);
    },
    tryNext: "list each job id from world/desk.yaml once under jobs: (group-the-reports, write-the-customer-updates, plan-the-crews, switch-the-feeder)",
  },
  {
    says: "every job sits on one rung of the ladder",
    test: (d) => all(d, (j) => RUNGS.includes(j.rung)),
    tryNext: `set rung: to one of ${RUNGS.join(", ")}`,
  },
  {
    says: "every job says who decides the next step, and that matches its rung",
    test: (d) => all(d, (j) => DECIDES[j.rung] !== undefined && j.decides_next_step === DECIDES[j.rung]),
    tryNext: "a person decides on the person rung, code decides on one-call and workflow, the model decides on agent and many-agents",
  },
  {
    says: "every job has a trigger and a lifetime with a number and a unit",
    test: (d) => all(d, (j) => TRIGGERS.includes(j.trigger) && /^(seconds|minutes|hours)$/.test(amount(j.lifetime)?.unit ?? "")),
    tryNext: `set trigger: to one of ${TRIGGERS.join(", ")} and lifetime: to a number and a unit, such as 20 minutes`,
  },
  {
    says: "every job on the agent or many-agents rung names why rules cannot do it",
    test: (d) => all(d, (j) => !isAgentRung(j.rung) || AGENT_REASONS.includes(j.reason)),
    tryNext: `give each agent job a reason: from ${AGENT_REASONS.join(", ")}, or move it down the ladder`,
  },
  {
    says: "a job the desk policy reserves for a person sits on the person rung",
    test: async (d) => {
      const reserved = (await readDesk()).jobs.filter((j) => j.reserved_for_person).map((j) => j.id);
      return reserved.every((id) => jobs(d).some((j) => j.job === id && j.rung === "person"));
    },
    tryNext: "read world/policy.md rule P1: only an authorised switching engineer operates a switch, so switch-the-feeder is rung: person",
  },
  {
    says: "at least one machine job sits below the agent rung",
    test: (d) => jobs(d).some((j) => j.rung === "one-call" || j.rung === "workflow"),
    tryNext: "ask of each job: can code decide every next step? If yes, it is a workflow or one model call, not an agent",
  },
  {
    says: "every job says why it sits on that rung, in at least 8 words",
    test: (d) => all(d, (j) => filled(j.why) && words(j.why) >= 8),
    tryNext: "under why: write one sentence that names a fact of the storm desk, such as how varied the reports are",
  },
] satisfies Rule[];
