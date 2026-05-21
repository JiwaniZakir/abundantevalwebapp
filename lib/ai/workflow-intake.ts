import { z } from "zod";
import {
  coerceStringArray,
  coerceWorkflowFixtureCategories,
} from "./coerce-llm-json";
import { getAiModel } from "./providers";
import { generateStructuredObject } from "./structured-output";
import { failureModes } from "@/lib/domain/taxonomy";

const fixtureCategorySchema = z.object({
  name: z.string().default("baseline"),
  count: z.coerce.number().int().min(1).max(60).default(12),
  description: z.string().default("Representative operational rows."),
});

export const workflowIntakeSchema = z.object({
  domain: z.string().default("operations").describe("Short domain label, e.g. 'invoice reconciliation' or 'compliance release'."),
  deliverable: z.string().default("operational deliverable").describe("The operational artifact the analyst would actually produce."),
  weaknessTitle: z.string().default("Workflow weakness").describe("Concise weakness card title (no failure-mode jargon)."),
  hypothesis: z.string().default("Models shortcut operational steps under pressure.").describe("One paragraph why frontier models fail on this workflow."),
  badHeuristic: z.string().default("Accept the most recent export without reconciling sources.").describe("The shortcut the model is tempted to take."),
  authorityInvariant: z.string().default("Deliverable must respect the authoritative policy artifact.").describe("The policy invariant the deliverable must respect."),
  taxonomySlug: z
    .string()
    .default("lifecycle")
    .describe("Best matching failure-mode taxonomy slug.")
    .transform((value) => {
      const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
      const allowed = [
        "authority_ambiguity",
        "false_recency",
        "wrong_source",
        "phantom_join",
        "tie_breaking",
        "null_cascade",
        "provenance",
        "lifecycle",
      ] as const;
      return allowed.includes(normalized as (typeof allowed)[number])
        ? (normalized as (typeof allowed)[number])
        : "lifecycle";
    }),
  suggestedAuthorityArtifacts: z
    .preprocess(
      coerceStringArray,
      z.array(z.string()).max(6),
    )
    .default(["policy.txt"])
    .describe("Filenames for authority artifacts the agent should read (e.g. 'policy.pdf')."),
  suggestedFixtureCategories: z
    .preprocess(
      coerceWorkflowFixtureCategories,
      z.array(fixtureCategorySchema).max(8),
    )
    .default([
      { name: "clean_rows", count: 12, description: "Unambiguous rows." },
      { name: "edge_rows", count: 12, description: "Rows that stress reconciliation." },
    ])
    .describe("Fixture categories with row counts (clean rows + trap families). Each item must be an object with name, count, description."),
});

export type WorkflowIntake = z.infer<typeof workflowIntakeSchema>;

const intakeSystemPrompt = `You convert freeform analyst workflow descriptions into a Harbor weakness card.

You will receive a workflow description plus the eight-category failure-mode taxonomy.

Rules:
- Pick the single best taxonomy match.
- Never use failure-mode jargon in the weakness title or hypothesis (no "trap", "recency", "phantom join", etc.).
- The bad heuristic should describe what a competent-but-rushed analyst would do.
- The authority invariant should be operational (what the deliverable must respect), not abstract.
- Authority artifacts are filenames an agent could reasonably read (policies, contracts, dependency graphs).
- Fixture categories include both clean rows and "bait" rows whose name hints at the operational scenario, not the failure mode.
- suggestedFixtureCategories must be a JSON array of objects, each with keys: name (string), count (integer), description (string). Do not return category names as plain strings.
- Return JSON with all keys populated: domain, deliverable, weaknessTitle, hypothesis, badHeuristic, authorityInvariant, taxonomySlug, suggestedAuthorityArtifacts, suggestedFixtureCategories.`;

export async function intakeWorkflow({
  provider,
  modelSlug,
  description,
}: {
  provider: string;
  modelSlug: string;
  description: string;
}): Promise<WorkflowIntake> {
  const taxonomySummary = failureModes
    .map((mode) => `- ${mode.slug}: ${mode.name} – ${mode.description}`)
    .join("\n");

  return generateStructuredObject({
    model: getAiModel(provider, modelSlug),
    schema: workflowIntakeSchema,
    schemaName: "WorkflowIntake",
    system: intakeSystemPrompt,
    prompt: `Workflow description:\n"""\n${description.trim()}\n"""\n\nFailure-mode taxonomy:\n${taxonomySummary}\n\nReturn a single weakness card.`,
  });
}
