// The shapes of the world's seed data. On disk the names are snake_case (smart_meter);
// world/lib/field-names.ts turns them into these camelCase names when a file is read.

export type Device = {
  id: string;
  kind: "recloser" | "fuse";
  feeder: string;
  parent: string | null;
  streets: string[];
};

export type Customer = {
  id: string;
  number: number;
  street: string;
  device: string;
  smartMeter: boolean;
  critical: string | null;
  name?: string;
};

export type Crew = { id: string; depot: string; skills: string[] };

export type Report = {
  id: string;
  at: number;
  channel: "meter" | "phone" | "text" | "web";
  customerHint: string | null;
  text: string;
};

// An outage that really happens in the storm. Only the board and the checks read these.
export type TrueOutage = {
  id: string;
  device: string;
  startsAt: number;
  repairMinutes: number;
  travelMinutes: number;
  nestedUnder: string | null;
};

export type ReportTruth = { customer: string; dark: boolean };

export type Truth = { outages: TrueOutage[]; reportTruth: Record<string, ReportTruth> };

export type Substation = { id: string; name: string; feeders: string[] };

export type Network = { company: string; substations: Substation[]; devices: Device[] };
