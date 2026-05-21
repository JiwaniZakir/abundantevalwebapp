import { z } from "zod";
import { getAiModel } from "./providers";
import { generateStructuredObject } from "./structured-output";
import { failureModes } from "@/lib/domain/taxonomy";
import type { WeaknessCandidate, WeaknessReport } from "@/lib/agent/types";

const candidateSchema = z.object({
  weaknessTitle: z.string().default("Workflow weakness"),
  domain: z.string().default("operations"),
  deliverable: z.string().default("operational deliverable"),
  hypothesis: z.string().default("Models shortcut operational steps under pressure."),
  badHeuristic: z.string().default("Accept the most recent export without reconciling sources."),
  authorityInvariant: z
    .string()
    .default("Deliverable must respect the authoritative policy artifact."),
  taxonomySlug: z
    .string()
    .default("lifecycle")
    .transform((value) => {
      const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
      const allowed = failureModes.map((m) => m.slug);
      return allowed.includes(normalized as (typeof allowed)[number])
        ? normalized
        : "lifecycle";
    }),
  workflowFitScore: z.coerce.number().min(0).max(1).default(0.7),
  verifierStrategy: z.string().default("Deterministic pytest over deliverable shape and policy invariants."),
});

export const weaknessReportSchema = z.object({
  candidates: z.array(candidateSchema).min(3).max(10),
});

function slugifyTitle(title: string) {
  return title
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function truncate(value: string, max: number) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}

export function renderWeaknessReportMarkdown(report: WeaknessReport): string {
  const lines = [
    "# Weakness map",
    "",
    report.workflowDescription,
    "",
    "| Rank | Title | Taxonomy | Fit | Status |",
    "|------|-------|----------|-----|--------|",
  ];
  report.candidates.forEach((c, i) => {
    lines.push(
      `| ${i + 1} | ${c.weaknessTitle} | ${c.taxonomySlug} | ${Math.round(c.workflowFitScore * 100)}% | ${c.status} |`,
    );
  });
  lines.push("", "## Candidates", "");
  for (const c of report.candidates) {
    lines.push(
      `### ${c.weaknessTitle}`,
      `- Domain: ${c.domain}`,
      `- Deliverable: ${c.deliverable}`,
      `- Taxonomy: ${c.taxonomySlug}`,
      `- Fit score: ${c.workflowFitScore}`,
      `- Verifier: ${c.verifierStrategy}`,
      `- Authority invariant: ${c.authorityInvariant}`,
      "",
      c.hypothesis,
      "",
    );
  }
  return lines.join("\n");
}

export async function mapWorkflowWeaknesses({
  provider,
  modelSlug,
  description,
}: {
  provider: string;
  modelSlug: string;
  description: string;
}): Promise<WeaknessReport> {
  const taxonomySummary = failureModes
    .map((mode) => `- ${mode.slug}: ${mode.name} – ${mode.description}`)
    .join("\n");

  const result = await generateStructuredObject({
    model: getAiModel(provider, modelSlug),
    schema: weaknessReportSchema,
    schemaName: "WeaknessReport",
    system: `You map operational workflows to 5-10 distinct Harbor weakness candidates.

Rules:
- Each candidate must use a different taxonomy slug when possible.
- Never use failure-mode jargon in titles (no "trap", "phantom join", etc.).
- workflowFitScore is 0-1 confidence this workflow exposes that weakness.
- verifierStrategy describes deterministic checks, not LLM judges.
- Return JSON with candidates array of objects (not strings).`,
    prompt: `Workflow:\n"""\n${description.trim()}\n"""\n\nTaxonomy:\n${taxonomySummary}\n\nReturn 5-10 ranked weakness candidates.`,
  });

  const candidates: WeaknessCandidate[] = result.candidates.map((c) => {
    const title = truncate(c.weaknessTitle, 80);
    return {
      slug: slugifyTitle(title),
      weaknessTitle: title,
      domain: truncate(c.domain, 60),
      deliverable: truncate(c.deliverable, 120),
      hypothesis: truncate(c.hypothesis, 500),
      badHeuristic: truncate(c.badHeuristic, 200),
      authorityInvariant: truncate(c.authorityInvariant, 200),
      taxonomySlug: c.taxonomySlug,
      workflowFitScore: c.workflowFitScore,
      verifierStrategy: truncate(c.verifierStrategy, 200),
      status: "candidate" as const,
    };
  });

  return {
    workflowDescription: description.trim(),
    candidates,
    createdAt: Date.now(),
  };
}
