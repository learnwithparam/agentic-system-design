// The finished system: the sample design for the Copperbeck storm desk,
// played through one storm night.
//   group-the-reports           a workflow: code routes each report,
//                               and a fast model call reads messy text
//   write-the-customer-updates  one model call per outage
//   plan-the-crews              an agent (smart role) that picks a crew and a restore time,
//                               one tool call per turn
//   switch-the-feeder           a person: the switching engineer
// Guards in code: P2 (never close while meters behind the device are dark)
// and P3 (critical customers get a person).
import { groupTheReports } from "./group-the-reports";
import { planTheCrews, tryToClose } from "./plan-the-crews";
import {
  allOutages,
  darkMetersBehind,
  type Outage,
  recordEvent,
  type Storm,
  startStorm,
} from "./storm-state";

// The storm clock moves 5 minutes at a time, for at most 1,200 minutes.
const MINUTES_PER_TICK = 5;
const LAST_MINUTE = 1200;

// The physical world: is any device between this home and the substation broken right now?
function homeIsDark(storm: Storm, device: string): boolean {
  const devicesAbove = [device, storm.parentOf.get(device)];
  return devicesAbove.some((candidate) => {
    if (!candidate || storm.repairedDevices.has(candidate)) return false;
    const failure = storm.failureOn.get(candidate);
    return failure !== undefined && failure.startsAt <= storm.now;
  });
}

// Each smart meter reports when its power changes. At minute 0 only dark meters report.
function refreshMeters(storm: Storm) {
  const smartMeterHomes = storm.customers.filter((customer) => customer.smartMeter);
  for (const customer of smartMeterHomes) {
    const hasPower = !homeIsDark(storm, customer.device);
    if (storm.hasPower.get(customer.id) === hasPower) continue;
    storm.hasPower.set(customer.id, hasPower);
    const powerFlag = hasPower ? 1 : 0;
    if (storm.now > 0 || !hasPower) storm.addMeterRead.run(customer.id, storm.now, powerFlag);
  }
}

// switch-the-feeder: when a crew finishes, the switching engineer (a person) puts power back.
function finishRepairs(storm: Storm) {
  for (const [outageId, doneAt] of storm.crewDoneAt) {
    if (doneAt > storm.now) continue;
    const sql = "SELECT device FROM outages WHERE id = ?";
    const { device } = storm.db.query(sql).get(outageId) as { device: string };
    storm.crewDoneAt.delete(outageId);
    storm.repairedDevices.add(device);
    storm.db.run("UPDATE devices SET energized = 1 WHERE id = ?", [device]);
    const restore = "UPDATE outages SET status = 'restored', restored_at = ? WHERE id = ?";
    storm.db.run(restore, [storm.now, outageId]);
    recordEvent(storm, {
      at: storm.now,
      kind: "person",
      tool: "switch_the_feeder",
      by: "person:switching-engineer",
      args: { device },
      result: "energized",
    });
  }
}

// Devices that fail during this tick lose power.
function startFaults(storm: Storm) {
  for (const failure of storm.trueOutages) {
    const startsNow = failure.startsAt === storm.now;
    const startedThisTick =
      failure.startsAt < storm.now && failure.startsAt > storm.now - MINUTES_PER_TICK;
    if (startsNow || startedThisTick) {
      storm.db.run("UPDATE devices SET energized = 0 WHERE id = ?", [failure.device]);
    }
  }
}

// Ask the agent to close each restored outage: once when power comes back,
// and again after a block, once every meter behind it reports power.
async function closeRestoredOutages(storm: Storm) {
  const restored = allOutages(storm).filter((outage) => {
    return outage.status === "restored" && !outage.closedAt;
  });
  for (const outage of restored) {
    const justRestored = outage.restoredAt === storm.now;
    if (justRestored || darkMetersBehind(storm, outage.device).length === 0) {
      await tryToClose(storm, outage);
    }
  }
}

function stormIsOver(storm: Storm): boolean {
  const everyDeviceRepaired = storm.trueOutages.every((failure) => {
    return storm.repairedDevices.has(failure.device);
  });
  const everyOutageClosed = allOutages(storm).every((outage: Outage) => outage.closedAt !== null);
  return everyDeviceRepaired && everyOutageClosed;
}

async function playOneTick(storm: Storm) {
  finishRepairs(storm);
  startFaults(storm);
  refreshMeters(storm);
  await closeRestoredOutages(storm);
  const freshReports = storm.reports.filter((report) => {
    return report.at > storm.now - MINUTES_PER_TICK && report.at <= storm.now;
  });
  if (freshReports.length) await groupTheReports(storm, freshReports);
  await planTheCrews(storm);
}

export type StormOptions = { log?: (line: string) => void };

export async function runStorm(dir: string, options: StormOptions = {}) {
  const storm = startStorm(dir, options.log ?? (() => {}));
  const reportCount = storm.reports.length.toLocaleString("en-US");
  storm.log(`Storm night at Copperbeck Power: ${reportCount} reports arrive.`);
  for (storm.now = 0; storm.now <= LAST_MINUTE; storm.now += MINUTES_PER_TICK) {
    await playOneTick(storm);
    // The storm is not over before minute 360, even if the desk is quiet.
    if (storm.now > 360 && stormIsOver(storm)) break;
  }
  storm.db.close();
  return { run: storm.run, dir: storm.files.dir, endedAt: storm.now };
}
