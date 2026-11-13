---

status: accepted

---

# A person approves every customer text

## Context and Problem Statement

`notify_customers` cannot be undone: a text that reached a phone stays there. A wrong restore time to a care
home is a safety event. But every gate takes some of the desk lead's attention on a storm night. Where does
a person say yes?

This decides the [Gates](../design.md#gates) section.

## Considered Options

- Gate every text once per outage, and route every critical customer to a call by the desk lead
- Gate only texts to critical customers
- No gate; check the texts after they are sent

## Decision Outcome

Chosen option: "Gate every text once per outage, and route every critical customer to a call by the desk
lead". It costs about 12 gates a shift in a storm month, well under the limit of 30.

### Consequences

- Good, because no text leaves without a person reading it.
- Good, because rule P3 holds: a critical customer always hears a person.
- Bad, because customers wait up to 10 more minutes for their text when the desk is busy.

### Confirmation

`bun run verify place-the-gates` passes: every tier-high tool has a gate, and no gate proceeds on timeout.
