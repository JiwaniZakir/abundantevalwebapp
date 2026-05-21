import { generateObject } from "ai";
import { z } from "zod";
import { getAiModel } from "./providers";

export const scaffoldSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .describe("Kebab-case task slug, e.g. invoice-reconciliation."),
  outputFilename: z
    .string()
    .describe("Exact deliverable path, e.g. /root/audit_report.xlsx."),
  instructionMd: z.string().describe("Operational, no failure-mode jargon."),
  taskToml: z.string().describe("Valid Harbor task.toml content."),
  dockerfile: z.string().describe("python:3.12 base + pinned pip installs."),
  buildInputsPy: z.string().describe("Python fixture builder."),
  solveSh: z.string().describe("#!/bin/bash oracle solve script."),
  testOutputsPy: z.string().describe("pytest verifier with deterministic checks."),
  policyArtifactPath: z.string().describe("Path of the authority artifact (e.g. policy/foo.pdf.txt)."),
  policyArtifactBody: z.string().describe("Authority artifact text body."),
});

export type Scaffold = z.infer<typeof scaffoldSchema>;

const scaffoldSystemPrompt = `You generate Harbor task packs in the restaurant-style pattern.

Hard rules:
- Never name the failure mode or "trap" inside agent-visible artifacts.
- Never write expected answers, .oracle_expected.json, or answer keys.
- instruction.md describes the operational deliverable, the input file inventory, the exact output filename/sheets/headers, and constraints. No "do not" sentences naming the trap. No verifier pseudocode.
- task.toml uses [metadata] difficulty="hard", [environment] cpus=1, memory_mb=4096, storage_mb=10240, [agent] timeout_sec=1800, [verifier] timeout_sec=900.
- Dockerfile: FROM python:3.12; install openpyxl==3.1.5 pandas==2.2.3 pdfplumber==0.11.4 fpdf2==2.8.2 pytest==8.3.3.
- solve.sh is a bash heredoc that calls python3 to materialize the deliverable from /root/data.
- tests/test_outputs.py uses pytest only. No LLM judges.
- policyArtifactBody is the actual authority artifact text (policy v3.x); it lives at the policyArtifactPath inside /root/data and is what the agent must consult.`;

export async function generateScaffold({
  provider,
  modelSlug,
  weaknessTitle,
  hypothesis,
  badHeuristic,
  authorityInvariant,
  deliverable,
  domain,
  fixtureCategories,
}: {
  provider: string;
  modelSlug: string;
  weaknessTitle: string;
  hypothesis: string;
  badHeuristic: string;
  authorityInvariant: string;
  deliverable: string;
  domain: string;
  fixtureCategories: Array<{ name: string; count: number; description: string }>;
}): Promise<Scaffold> {
  const result = await generateObject({
    model: getAiModel(provider, modelSlug),
    schema: scaffoldSchema,
    system: scaffoldSystemPrompt,
    prompt: `Domain: ${domain}\nDeliverable: ${deliverable}\nWeakness title: ${weaknessTitle}\nHypothesis: ${hypothesis}\nBad heuristic (for your internal awareness only, do not echo): ${badHeuristic}\nAuthority invariant the deliverable must respect: ${authorityInvariant}\nFixture categories: ${JSON.stringify(fixtureCategories, null, 2)}\n\nReturn a complete Harbor task pack.`,
  });

  return result.object;
}
