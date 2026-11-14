import type { Rule } from "../scripts/verify";
import { asList, block, designData, readDesign, wordCount } from "./lib/design";
import { readDesk } from "./lib/world";

// The Load block. A learner may leave any field out, so every field is optional.
type Latency = { job?: unknown; budgetSeconds?: unknown; why?: unknown };
type Load = {
  requirements?: unknown;
  load?: { reportsPerNight?: unknown; outagesPerNight?: unknown };
  latency?: unknown;
  capacity?: { reportsNeedingModel?: unknown; callsPerNight?: unknown };
};

const loadOf = (folder: string) => designData<Load>(folder, "Load") ?? {};
const latencies = (folder: string) => asList<Latency>(loadOf(folder).latency);
const isPositive = (value: unknown) => typeof value === "number" && value > 0;

// The jobs software may do. A job reserved for a person has no latency budget.
async function machineJobs(): Promise<string[]> {
  const desk = await readDesk();
  return desk.jobs.filter((job) => !job.reservedForPerson).map((job) => job.id);
}

const budgetFor = (folder: string, jobName: string) =>
  latencies(folder).find((entry) => entry.job === jobName)?.budgetSeconds;

export default [
  {
    says: "design.md has a Load section with a yaml design block",
    test: (folder) => block(readDesign(folder), "Load").ok,
    tryNext: "fill the yaml design block under ## Load in design.md; keep the fence line",
  },
  {
    says: "there are at least two requirements, each a full sentence",
    test: (folder) => {
      const lines = asList<unknown>(loadOf(folder).requirements);
      return lines.length >= 2 && lines.every((line) => wordCount(line) >= 5);
    },
    tryNext: "write what a customer, a critical customer and a crew need, one sentence each",
  },
  {
    says: "every job a machine does has a latency budget in seconds and a reason",
    test: async (folder) => {
      const jobs = await machineJobs();
      return jobs.every((jobName) => {
        const entry = latencies(folder).find((item) => item.job === jobName);
        return isPositive(entry?.budgetSeconds) && wordCount(entry?.why) >= 5;
      });
    },
    tryNext: "give each job a budget_seconds that is a plain number, such as 5, and say why",
  },
  {
    says: "the load is the storm night in world/desk.yaml, not a storm month",
    test: async (folder) => {
      const night = (await readDesk()).volumes.stormNight;
      const { reportsPerNight, outagesPerNight } = loadOf(folder).load ?? {};
      return reportsPerNight === night.reports && outagesPerNight === night.outages;
    },
    tryNext: "copy reports and outages from storm_night in world/desk.yaml",
  },
  {
    says: "the crew plan, a loop of calls, has a longer budget than a single call",
    test: (folder) => {
      const agent = budgetFor(folder, "plan-the-crews");
      const singleCall = budgetFor(folder, "write-the-customer-updates");
      return isPositive(agent) && isPositive(singleCall) && Number(agent) > Number(singleCall);
    },
    tryNext: "an agent makes several calls in a row, so give plan-the-crews the longest budget",
  },
  {
    says: "capacity counts the reports that need a model, and at least one call for each",
    test: (folder) => {
      const { reportsNeedingModel, callsPerNight } = loadOf(folder).capacity ?? {};
      const reports = loadOf(folder).load?.reportsPerNight;
      if (!isPositive(reportsNeedingModel) || !isPositive(callsPerNight)) return false;
      const fewerThanAll = Number(reportsNeedingModel) < Number(reports);
      return fewerThanAll && Number(callsPerNight) >= Number(reportsNeedingModel);
    },
    tryNext:
      "smart meter alarms need no model, so reports_needing_model is below the total; " +
      "calls_per_night is at least that number",
  },
] satisfies Rule[];
