import { z } from "zod";

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
