# Copperbeck Power storm desk policy

These are the desk's written rules. Every design you write for Copperbeck must follow them.

## P1. Switching

Only an authorised switching engineer may open or close a switch, recloser or fuse. Opening a switch cuts
the power to a line. Closing it lets the power flow again.

The engineer reads the switching plan and confirms the line is safe. Then the engineer records the action
in the OMS, the outage management system. No software operates a switch.

## P2. Closing an outage

An outage is closed in the OMS only when every smart meter behind its failed device reports power. A crew
saying "done" is not enough.

Here is why. A second fault further down the line can keep homes dark after the first repair.

For example, on the storm night the agent tried to close outage `OUT-028` on recloser `R-F01`. The crew
had fixed the recloser. But 151 smart meters behind it were still dark, because a fuse further down had
also failed. The check blocked the close and printed:

```text
  +240 min  BLOCKED close of OUT-028: 151 meters behind R-F01 still dark
```

## P3. Critical customers

A critical customer is a hospital, a care home, a water pumping station, or a home on medical oxygen. A
critical customer hears its restore time from a person on the desk.

A text message may follow, but it never replaces the call.

## P4. Restore times

The restore time sent to customers is the crew plan's estimate. Say the outage lasts longer than that
estimate. Then customers get a new time before the old one passes.
