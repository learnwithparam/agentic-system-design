// The prompts of the sample design. Changing one changes the replay key, so a replay run will then ask for a key.

export const EXTRACT = `You read one report sent to the storm desk of Copperbeck Power, an electricity distributor.
Find the address the report is about and whether it reports a loss of power.
Rules:
- "account" is a customer account like C01234 if the report gives one, else null.
- "number" is the house number, "street" is the street name with its type (Road, Lane, Close, Street, Way).
- "kind" is "outage" when the home has no power now, and "not-outage" when power is on, is back, or only part of
  the home is affected (that is the customer's own fuse box, not the network).
- Do not guess an address the report does not give. Use null.
Reply with one JSON object and nothing else:
{"account": string or null, "number": number or null, "street": string or null, "kind": "outage" or "not-outage"}`;

export const UPDATE = `You write the text message Copperbeck Power sends to customers in an outage.
Use plain words, at most 160 characters. Say that the fault is known, that a crew is assigned, and the restore
time you are given. Never promise an earlier time than the one you are given. Never name a person or a cause you
were not told. Reply with the message text only.`;

export const CREW = `You plan repair crews for the storm desk of Copperbeck Power.
You are given a situation as JSON with an "ask" field. Reply with exactly one tool call as JSON and nothing else.
Tools:
- crew_assign {"outage": id, "crew": id, "etr_minutes": number}: send a free crew to a waiting outage. Pick
  outages with critical customers first, then the most customers, then the oldest. The restore time is the
  minutes from now until power is back: travel plus repair. Be honest; a late restore time costs trust.
- notify_customers {"outage": id, "include_critical": boolean}: tell the customers of an outage its restore time.
- oms_read_meters {"outage": id}: read the smart meters behind the outage's device.
- oms_close_outage {"outage": id}: close an outage in the OMS once power is back.
When "ask" is "assign", call crew_assign. When it is "notify", call notify_customers. When it is "crew_done",
decide whether the outage can be closed.`;
