// The ladder and the patterns, as the checks read them.

// The rungs, from no model at all to many agents.
export const RUNGS: readonly string[] = ["person", "one-call", "workflow", "agent", "many-agents"];

// Who decides the next step on each rung. This is what makes a rung a rung.
export const DECIDES: Record<string, string> = {
  person: "person",
  "one-call": "code",
  workflow: "code",
  agent: "model",
  "many-agents": "model",
};

export const TRIGGERS = ["person", "event", "schedule", "agent"];

// The only reasons a job may need an agent instead of rules.
export const AGENT_REASONS = ["open-ended-steps", "varied-input", "parallel-breadth"];

export const isAgentRung = (rung: unknown) => rung === "agent" || rung === "many-agents";

// Patterns, ranked from the simplest. Patterns with the same rank cost about the same.
export const PATTERN_RANK: Record<string, number> = {
  none: 0,
  person: 0,
  "single-call": 1,
  chain: 2,
  route: 2,
  parallel: 2,
  "orchestrator-workers": 3,
  "evaluator-optimizer": 3,
  "agent-loop": 4,
  "many-agents": 5,
};

export const PATTERNS_FOR_RUNG: Record<string, string[]> = {
  person: ["person"],
  "one-call": ["single-call"],
  workflow: ["chain", "route", "parallel", "orchestrator-workers", "evaluator-optimizer"],
  agent: ["agent-loop"],
  "many-agents": ["many-agents"],
};

// Token use against a chat, from Anthropic's multi-agent research system post (read 12 Nov 2026):
// "agents typically use about 4x more tokens than chat interactions,
// and multi-agent systems use about 15x".
// Each pattern maps to the lowest and highest multiplier a design may claim.
export const TOKEN_MULTIPLIER: Record<string, [number, number]> = {
  "agent-loop": [3, 5],
  "many-agents": [10, 20],
};
