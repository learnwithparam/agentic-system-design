export type Device = { id: string; kind: "recloser" | "fuse"; feeder: string; parent: string | null; streets: string[] };
export type Customer = { id: string; number: number; street: string; device: string; smart_meter: boolean; critical: string | null; name?: string };
export type Crew = { id: string; depot: string; skills: string[] };
export type Report = { id: string; at: number; channel: "meter" | "phone" | "text" | "web"; customer_hint: string | null; text: string };
export type TrueOutage = { id: string; device: string; starts_at: number; repair_minutes: number; travel_minutes: number; nested_under: string | null };
export type Truth = { outages: TrueOutage[]; report_truth: Record<string, { customer: string; dark: boolean }> };
export type Network = { company: string; substations: { id: string; name: string; feeders: string[] }[]; devices: Device[] };
