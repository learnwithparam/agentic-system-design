// The ladder and the patterns, as the checks read them.

// The rungs, from no model at all to many agents.
export const RUNGS = ["person", "one-call", "workflow", "agent", "many-agents"] as const;
// Who decides the next step on each rung. This is what makes a rung a rung.
export const DECIDES: Record<string, string> = { person: "person", "one-call": "code", workflow: "code", agent: "model", "many-agents": "model" };
export const TRIGGERS = ["person", "event", "schedule", "agent"];
export const AGENT_REASONS = ["open-ended-steps", "varied-input", "parallel-breadth"];
export const isAgentRung = (r: string) => r === "agent" || r === "many-agents";

// Patterns, ranked from simplest. Patterns on the same rank are alternatives of the same cost class.
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
// "agents typically use about 4x more tokens than chat interactions, and multi-agent systems use about 15x".
export const TOKEN_MULTIPLIER: Record<string, [number, number]> = { "agent-loop": [3, 5], "many-agents": [10, 20] };
