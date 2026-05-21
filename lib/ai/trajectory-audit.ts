import { generateObject } from "ai";
import { z } from "zod";
import { getAiModel } from "./providers";

export const trajectoryAuditSchema = z.object({
  auditorModel: z.string(),
  classification: z.enum([
    "ignored_authority_artifact",
    "used_prior_work_heuristic",
    "format_violation",
    "misread_input",
    "task_design_bug",
    "environment_failure",
  ]),
  rationale: z.string(),
});

export type TrajectoryAudit = z.infer<typeof trajectoryAuditSchema>;

export function assertAuditorSeparation({
  targetModel,
  auditorModel,
}: {
  targetModel: string;
  auditorModel: string;
}) {
  if (targetModel === auditorModel) {
    throw new Error(
      "Auditor contamination: auditor_model must not equal target_model.",
    );
  }
}

export function auditTrajectoryHeuristically({
  targetModel,
  auditorModel,
  trajectoryText,
}: {
  targetModel: string;
  auditorModel: string;
  trajectoryText: string;
}): TrajectoryAudit {
  assertAuditorSeparation({ targetModel, auditorModel });

  const lower = trajectoryText.toLowerCase();

  if (lower.includes("portal") || lower.includes("prior")) {
    return {
      auditorModel,
      classification: "used_prior_work_heuristic",
      rationale:
        "The trajectory appears to trust a visible portal or prior-work artifact instead of deriving release eligibility from the dependency trace.",
    };
  }

  if (lower.includes("missing file") || lower.includes("enoent")) {
    return {
      auditorModel,
      classification: "environment_failure",
      rationale: "The failure looks infrastructure-related rather than model-related.",
    };
  }

  return {
    auditorModel,
    classification: "ignored_authority_artifact",
    rationale:
      "The trajectory did not show evidence of consulting the required authority artifact before publishing.",
  };
}

const llmAuditSchema = z.object({
  classification: trajectoryAuditSchema.shape.classification,
  rationale: z
    .string()
    .max(360)
    .describe("Why you classified this trajectory, citing a short excerpt."),
});

const auditSystemPrompt = `You audit a frontier model's failing Harbor trajectory and classify the root cause.

Classification options:
- ignored_authority_artifact: the model never opened or consulted the policy/authority artifact.
- used_prior_work_heuristic: the model trusted a prior workbook, portal export, or convenient shortcut instead of recomputing from authority.
- format_violation: output structure broke verifier requirements (missing sheets, headers, types).
- misread_input: the model misinterpreted an input file (wrong column, wrong rows).
- task_design_bug: the task itself was unverifiable or contradictory.
- environment_failure: missing files, harness crash, or non-model infrastructure issue.`;

export async function auditTrajectoryWithLlm({
  targetModel,
  auditorProvider,
  auditorModelSlug,
  trajectoryText,
}: {
  targetModel: string;
  auditorProvider: string;
  auditorModelSlug: string;
  trajectoryText: string;
}): Promise<TrajectoryAudit> {
  assertAuditorSeparation({
    targetModel,
    auditorModel: auditorModelSlug,
  });

  const result = await generateObject({
    model: getAiModel(auditorProvider, auditorModelSlug),
    schema: llmAuditSchema,
    system: auditSystemPrompt,
    prompt: `Trajectory excerpt (truncated):\n"""\n${trajectoryText.slice(0, 4000)}\n"""\n\nClassify the failure.`,
  });

  return {
    auditorModel: auditorModelSlug,
    classification: result.object.classification,
    rationale: result.object.rationale,
  };
}
