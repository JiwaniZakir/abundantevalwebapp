import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";

export const modelRegistry = [
  {
    provider: "google",
    label: "Gemini 3 Flash Preview",
    modelSlug: "google/gemini-3-flash-preview",
    runner: "gemini-cli",
  },
  {
    provider: "anthropic",
    label: "Claude 4.6 Sonnet",
    modelSlug: "claude-4.6-sonnet",
    runner: "claude-cli",
  },
  {
    provider: "openai",
    label: "GPT-5.3 Codex",
    modelSlug: "gpt-5.3-codex",
    runner: "openai-responses",
  },
] as const;

export function getAiModel(provider: string, modelSlug: string) {
  if (provider === "anthropic") return anthropic(modelSlug);
  if (provider === "openai") return openai(modelSlug);
  return google(modelSlug);
}

export function defaultAuditorFor(targetProvider: string) {
  if (targetProvider === "google") return "claude-4.6-sonnet";
  if (targetProvider === "anthropic") return "gpt-5.3-codex";
  return "claude-4.6-sonnet";
}
