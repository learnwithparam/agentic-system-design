# Start here

On this page, you set up the repo and meet Copperbeck Power's storm desk. Then you run the finished
system and see your goal. It takes about 15 minutes, and you do not need a model key.

## 1. Set up (4 minutes)

You need [Bun](https://bun.sh) and git. Bun is the tool that runs this course's scripts. Open a terminal
in the repo folder and run:

```bash
bun install
```

Expect: `bun install` ends with no errors.

```bash
bun run models
```

Expect: `Every role answers.` The default provider is `replay`: recorded model replies, no key, no cost.

Replay mode plays back model replies that were saved before. So the course gives the same result every
time, and it is free.

For example, `bun run models` prints one line per role. A role is a job a model does in the course, such
as `fast` or `judge`:

```text
Provider: replay
  fast   PASS  recorded replies found, cost $0.0000
  smart  PASS  recorded replies found, cost $0.0000
  judge  PASS  recorded replies found, cost $0.0000
Every role answers.
```

Later, you may want to run with a live model. Copy `.env.example` to `.env`. Set `LLM_PROVIDER` to
`anthropic`, `openrouter` or `openai`, and fill in that one key. Nothing in this course needs it.

## 2. Meet the world (5 minutes)

```bash
bun run world reset
```

Expect: `World reset: world/state/oms.db seeded from world/seed/.` and then `The world is ready. Next: bun run storm`

This command builds the OMS again from the start files. The OMS is the outage management system: the
database that holds the truth about every outage.

Now read two pages. [world/README.md](../world/README.md) shows the network, the data and the OMS.
[world/policy.md](../world/policy.md) has the four rules every design must follow.

## 3. Run the finished system (4 minutes)

```bash
bun run storm
```

Expect: a timeline of outages opened, crews sent and two `BLOCKED` lines, then `Storm night replayed.`

The sample design splits the night into four jobs:

- A workflow groups the reports. A workflow is a fixed list of steps that code runs in order.
- One model call writes each customer text.
- An agent plans the crews. An agent is a model that picks its own next step.
- A person does the switching.

Its board:

![The storm night board of the finished system](images/storm-board.png)

Look at two numbers. First, the agent tried twice to close an outage because a crew said it was fixed.
But smart meters behind it were still dark, so a check in the code blocked it both times.

For example, here is one of those two lines in the timeline:

```text
  +240 min  BLOCKED close of OUT-028: 151 meters behind R-F01 still dark
```

Second, the whole night of model calls cost cents. Even so, 8% of reports still went to the wrong outage.

## 4. See the goal (2 minutes)

Your job across the four parts is a design for this desk. It must beat this board, or explain why it
cannot. Then you defend it with numbers.

Your first check is the orientation step:

```bash
bun run verify meet-the-outage-desk
```

Expect: `FAIL` lines, each with a `Try next:` line. That is the starting point; every step begins failing.

Every step fails at first. That is normal. Each `FAIL` line tells you what to do next.

![Your first run of the check: what fails and what to try next](images/first-run.png)

Now open [the step](../parts/00-meet-the-desk/01-meet-the-outage-desk/problem/README.md) and make it pass.

Did a command print something you did not expect? Look it up in [troubleshooting.md](troubleshooting.md).
