import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";

export type LlmProvider = "google" | "anthropic" | "openai";

const DEFAULT_GOOGLE_MODEL = "gemini-2.0-flash";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_OPENAI_MODEL = "gpt-4o";

export const modelRegistry = [
  {
    provider: "google",
    label: "Gemini 3 Flash Preview",
    modelSlug: "gemini-2.0-flash",
    runner: "gemini-cli",
  },
  {
    provider: "anthropic",
    label: "Claude 4.6 Sonnet",
    modelSlug: "claude-sonnet-4-20250514",
    runner: "claude-cli",
  },
  {
    provider: "openai",
    label: "GPT-5.3 Codex",
    modelSlug: "gpt-4o",
    runner: "openai-responses",
  },
] as const;

function normalizeModelSlug(provider: string, modelSlug: string) {
  if (provider === "google" && modelSlug.startsWith("google/")) {
    return modelSlug.slice("google/".length);
  }
  return modelSlug;
}

export function availableProviders(): LlmProvider[] {
  const out: LlmProvider[] = [];
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) out.push("google");
  if (process.env.ANTHROPIC_API_KEY?.trim()) out.push("anthropic");
  if (process.env.OPENAI_API_KEY?.trim()) out.push("openai");
  return out;
}

export function providerForModelSlug(modelSlug: string): LlmProvider {
  if (modelSlug.startsWith("claude")) return "anthropic";
  if (modelSlug.startsWith("gpt")) return "openai";
  return "google";
}

export function defaultModelForProvider(provider: LlmProvider): string {
  if (provider === "anthropic") return DEFAULT_ANTHROPIC_MODEL;
  if (provider === "openai") return DEFAULT_OPENAI_MODEL;
  return DEFAULT_GOOGLE_MODEL;
}

export function getAiModel(provider: string, modelSlug: string) {
  const slug = normalizeModelSlug(provider, modelSlug);
  if (provider === "anthropic") return anthropic(slug);
  if (provider === "openai") return openai(slug);
  return google(slug);
}

export function defaultAuditorFor(targetProvider: LlmProvider): string {
  if (targetProvider === "google") return DEFAULT_ANTHROPIC_MODEL;
  if (targetProvider === "anthropic") return DEFAULT_OPENAI_MODEL;
  return DEFAULT_ANTHROPIC_MODEL;
}

/** Pick target + auditor providers using only configured API keys. */
export function resolveAgentProviders(workspace: {
  targetModel: string;
}): {
  targetProvider: LlmProvider;
  targetModelSlug: string;
  auditorProvider: LlmProvider;
  auditorSlug: string;
} {
  const available = availableProviders();
  const preferredTarget = providerForModelSlug(workspace.targetModel);
  const targetProvider = available.includes(preferredTarget)
    ? preferredTarget
    : (available[0] ?? "google");

  const targetModelSlug =
    targetProvider === preferredTarget
      ? workspace.targetModel
      : defaultModelForProvider(targetProvider);

  const preferredAuditor = providerForModelSlug(defaultAuditorFor(targetProvider));
  const auditorProvider = available.includes(preferredAuditor)
    ? preferredAuditor
    : targetProvider;
  const auditorSlug =
    auditorProvider === preferredAuditor
      ? defaultAuditorFor(targetProvider)
      : defaultModelForProvider(auditorProvider);

  return { targetProvider, targetModelSlug, auditorProvider, auditorSlug };
}
