// The only file that names a model. Code asks for a role (fast, smart, judge), never an id.
// The provider comes from LLM_PROVIDER: replay (the default, no key), anthropic, openrouter or openai.
// Ids read from briefs/MODELS.md and the providers' model lists on 12 Nov 2026.

export type Role = "fast" | "smart" | "judge";
export type LiveProvider = "anthropic" | "openrouter" | "openai";
export type Provider = "replay" | LiveProvider;

export const ROLES: Role[] = ["fast", "smart", "judge"];

export const MODELS: Record<LiveProvider, Record<Role, string>> = {
  anthropic: { fast: "claude-haiku-5-5", smart: "claude-sonnet-5-5", judge: "claude-haiku-5-5" },
  openrouter: { fast: "nvidia/nemotron-3.5-lightning", smart: "anthropic/claude-sonnet-5.5", judge: "anthropic/claude-haiku-5.5" },
  openai: { fast: "gpt-6-luna", smart: "gpt-6-luna-pro", judge: "gpt-6-luna" },
};

export const KEY_NAME: Record<LiveProvider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  openai: "OPENAI_API_KEY",
};

// USD per million tokens. Anthropic: https://platform.claude.com/docs/en/about-claude/pricing, read 12 Nov 2026
// (Haiku 5.5 prices are for prompts up to 100,000 tokens). OpenRouter fast: briefs/MODELS.md, 12 Nov 2026.
// A role with no verified price is left out, and cost is then reported as unknown.
export type Price = { input: number; cachedInput: number; output: number };
export const PRICES: Partial<Record<LiveProvider, Partial<Record<Role, Price>>>> = {
  anthropic: {
    fast: { input: 0.1, cachedInput: 0.01, output: 0.5 },
    smart: { input: 2, cachedInput: 0.1, output: 10 },
    judge: { input: 0.1, cachedInput: 0.01, output: 0.5 },
  },
  openrouter: { fast: { input: 0.07, cachedInput: 0.07, output: 0.2 } },
};
export const PRICES_READ_ON = "2026-11-12";
export const PRICES_SOURCE = "https://platform.claude.com/docs/en/about-claude/pricing";

// Replay replies were shaped as Anthropic calls, so a replay run is priced at Anthropic list prices.
export const REPLAY_PRICED_AS: LiveProvider = "anthropic";

export function provider(): Provider {
  const p = (process.env.LLM_PROVIDER ?? "replay").trim().toLowerCase();
  if (p === "replay" || p in MODELS) return p as Provider;
  throw new Error(`LLM_PROVIDER is "${p}". Use replay, anthropic, openrouter or openai.`);
}

export function priceFor(p: Provider, role: Role): Price | undefined {
  return PRICES[p === "replay" ? REPLAY_PRICED_AS : p]?.[role];
}
