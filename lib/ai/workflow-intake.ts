import { generateObject } from "ai";
import { z } from "zod";
import { getAiModel } from "./providers";
import { failureModes } from "@/lib/domain/taxonomy";

export const workflowIntakeSchema = z.object({
  domain: z.string().describe("Short domain label, e.g. 'invoice reconciliation' or 'compliance release'."),
  deliverable: z.string().describe("The operational artifact the analyst would actually produce."),
  weaknessTitle: z.string().describe("Concise weakness card title (no failure-mode jargon)."),
  hypothesis: z.string().describe("One paragraph why frontier models fail on this workflow."),
  badHeuristic: z.string().describe("The shortcut the model is tempted to take."),
  authorityInvariant: z.string().describe("The policy invariant the deliverable must respect."),
  taxonomySlug: z
    .enum([
      "authority_ambiguity",
      "false_recency",
      "wrong_source",
      "phantom_join",
      "tie_breaking",
      "null_cascade",
      "provenance",
      "lifecycle",
    ])
    .describe("Best matching failure-mode taxonomy slug."),
  suggestedAuthorityArtifacts: z
    .array(z.string())
    .max(6)
    .describe("Filenames for authority artifacts the agent should read (e.g. 'policy.pdf')."),
  suggestedFixtureCategories: z
    .array(
      z.object({
        name: z.string(),
        count: z.number().int().min(1).max(60),
        description: z.string(),
      }),
    )
    .max(8)
    .describe("Fixture categories with row counts (clean rows + trap families)."),
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
- Fixture categories include both clean rows and "bait" rows whose name hints at the operational scenario, not the failure mode.`;

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

  const result = await generateObject({
    model: getAiModel(provider, modelSlug),
    schema: workflowIntakeSchema,
    system: intakeSystemPrompt,
    prompt: `Workflow description:\n"""\n${description.trim()}\n"""\n\nFailure-mode taxonomy:\n${taxonomySummary}\n\nReturn a single weakness card.`,
  });

  return result.object;
}
