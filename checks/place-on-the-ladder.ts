import type { Rule } from "../scripts/verify";
import { amount, asList, block, designData, isFilled, readDesign, wordCount } from "./lib/design";
import { AGENT_REASONS, DECIDES, isAgentRung, RUNGS, TRIGGERS } from "./lib/ladder";
import { readDesk } from "./lib/world";

// One job in the Shape block. A learner may leave any field out, so every field is optional.
type ShapeJob = {
  job?: unknown;
  rung?: string;
  decidesNextStep?: unknown;
  trigger?: string;
  lifetime?: unknown;
  reason?: string;
  why?: unknown;
};

const shapeJobs = (folder: string) =>
  asList<ShapeJob>(designData<{ jobs?: unknown }>(folder, "Shape")?.jobs);

// True when the Shape block lists at least one job and every job passes the test.
function everyJob(folder: string, passes: (job: ShapeJob) => boolean): boolean {
  const jobs = shapeJobs(folder);
  return jobs.length > 0 && jobs.every(passes);
}

const hasLifetime = (job: ShapeJob) => {
  const unit = amount(job.lifetime)?.unit ?? "";
  return /^(seconds|minutes|hours)$/.test(unit);
};

export default [
  {
    says: "design.md has a Shape section with a yaml design block",
    test: (folder) => block(readDesign(folder), "Shape").ok,
    tryNext:
      "open design.md in this folder and fill the yaml design block under ## Shape; " +
      "keep the fence line ```yaml design",
  },
  {
    says: "every job on the desk appears exactly once, and no other job",
    test: async (folder) => {
      const wanted = (await readDesk()).jobs.map((job) => job.id).sort();
      const written = shapeJobs(folder)
        .map((job) => String(job.job))
        .sort();
      return JSON.stringify(wanted) === JSON.stringify(written);
    },
    tryNext:
      "list each job id from world/desk.yaml once under jobs: (group-the-reports, " +
      "write-the-customer-updates, plan-the-crews, switch-the-feeder)",
  },
  {
    says: "every job sits on one rung of the ladder",
    test: (folder) => everyJob(folder, (job) => RUNGS.includes(job.rung as string)),
    tryNext: `set rung: to one of ${RUNGS.join(", ")}`,
  },
  {
    says: "every job says who decides the next step, and that matches its rung",
    test: (folder) =>
      everyJob(folder, (job) => {
        const decider = DECIDES[job.rung as string];
        return decider !== undefined && job.decidesNextStep === decider;
      }),
    tryNext:
      "a person decides on the person rung, code decides on one-call and workflow, " +
      "the model decides on agent and many-agents",
  },
  {
    says: "every job has a trigger and a lifetime with a number and a unit",
    test: (folder) =>
      everyJob(folder, (job) => TRIGGERS.includes(job.trigger as string) && hasLifetime(job)),
    tryNext:
      `set trigger: to one of ${TRIGGERS.join(", ")} and lifetime: to a number and a unit, ` +
      "such as 20 minutes",
  },
  {
    says: "every job on the agent or many-agents rung names why rules cannot do it",
    test: (folder) =>
      everyJob(folder, (job) => {
        return !isAgentRung(job.rung) || AGENT_REASONS.includes(job.reason as string);
      }),
    tryNext:
      `give each agent job a reason: from ${AGENT_REASONS.join(", ")}, ` +
      "or move it down the ladder",
  },
  {
    says: "a job the desk policy reserves for a person sits on the person rung",
    test: async (folder) => {
      const { jobs } = await readDesk();
      const reserved = jobs.filter((job) => job.reservedForPerson).map((job) => job.id);
      const written = shapeJobs(folder);
      return reserved.every((id) => {
        return written.some((job) => job.job === id && job.rung === "person");
      });
    },
    tryNext:
      "read world/policy.md rule P1: only an authorised switching engineer operates a switch, " +
      "so switch-the-feeder is rung: person",
  },
  {
    says: "at least one machine job sits below the agent rung",
    test: (folder) =>
      shapeJobs(folder).some((job) => job.rung === "one-call" || job.rung === "workflow"),
    tryNext:
      "ask of each job: can code decide every next step? " +
      "If yes, it is a workflow or one model call, not an agent",
  },
  {
    says: "every job says why it sits on that rung, in at least 8 words",
    test: (folder) => everyJob(folder, (job) => isFilled(job.why) && wordCount(job.why) >= 8),
    tryNext:
      "under why: write one sentence that names a fact of the storm desk, " +
      "such as how varied the reports are",
  },
] satisfies Rule[];
