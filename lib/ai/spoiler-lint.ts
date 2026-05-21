import { generateObject } from "ai";
import { z } from "zod";
import { getAiModel } from "./providers";

export const spoilerFindingSchema = z.object({
  artifactPath: z.string(),
  line: z.number(),
  severity: z.enum(["low", "medium", "high"]),
  ruleId: z.string(),
  message: z.string(),
});

export type SpoilerFinding = z.infer<typeof spoilerFindingSchema>;

const rules: Array<{
  id: string;
  severity: SpoilerFinding["severity"];
  pattern: RegExp;
  message: string;
}> = [
  {
    id: "explicit-do-not",
    severity: "high",
    pattern: /\bdo not\b|\bdon't\b/i,
    message:
      "Avoid direct negation. Restaurant-style tasks make failure emerge from artifacts, not instructions.",
  },
  {
    id: "trap-name",
    severity: "high",
    pattern:
      /trap|recency trap|phantom join|forbidden transform|revocation cascade/i,
    message: "Do not name the failure mode or trap family in agent-visible text.",
  },
  {
    id: "expected-answer",
    severity: "high",
    pattern: /\.oracle_expected|expected_answer|answer_key/i,
    message: "Expected answers must never be present in agent-visible fixture paths.",
  },
  {
    id: "recipe-sentence",
    severity: "medium",
    pattern: /publish .* only when|skip .* otherwise|first .* then .* then/i,
    message:
      "Data dictionaries and policies should describe artifacts, not verifier pseudocode.",
  },
  {
    id: "self-labelled-bait",
    severity: "medium",
    pattern: /\(newer valid_from\)|assumed|default \d+|not consulted/i,
    message:
      "Bait artifacts should read like analyst drafts, not self-incriminating tutorials.",
  },
];

export function lintSpoilers({
  artifactPath,
  content,
}: {
  artifactPath: string;
  content: string;
}): SpoilerFinding[] {
  const findings: SpoilerFinding[] = [];

  content.split(/\r?\n/).forEach((lineText, index) => {
    for (const rule of rules) {
      if (rule.pattern.test(lineText)) {
        findings.push({
          artifactPath,
          line: index + 1,
          severity: rule.severity,
          ruleId: rule.id,
          message: rule.message,
        });
      }
    }
  });

  return findings;
}

const llmFindingsSchema = z.object({
  findings: z.array(
    z.object({
      line: z.number().int().min(1),
      severity: z.enum(["low", "medium", "high"]),
      ruleId: z.string(),
      message: z.string(),
    }),
  ),
});

const llmSystemPrompt = `You scan agent-visible eval artifacts for spoilers.

Flag, with line numbers:
- Direct negation that names the trap ("do not ...", "don't ...").
- Trap-family names ("recency trap", "phantom join", "revocation cascade").
- Self-incriminating bait (e.g. "assumed 5", "default 12", "(newer valid_from)", "not consulted").
- Recipe sentences that double as verifier pseudocode.
- Expected-answer file paths in agent-visible directories.

Use line numbers 1-indexed against the artifact body. Severity: high (trap names, expected answers), medium (recipe sentences, bait labels), low (mild hints).`;

export async function lintSpoilersWithLlm({
  artifactPath,
  content,
  auditorProvider,
  auditorModelSlug,
}: {
  artifactPath: string;
  content: string;
  auditorProvider: string;
  auditorModelSlug: string;
}): Promise<SpoilerFinding[]> {
  if (content.trim().length === 0) return [];

  const numbered = content
    .split(/\r?\n/)
    .map((line, index) => `${index + 1}: ${line}`)
    .join("\n");

  const result = await generateObject({
    model: getAiModel(auditorProvider, auditorModelSlug),
    schema: llmFindingsSchema,
    system: llmSystemPrompt,
    prompt: `Artifact path: ${artifactPath}\nNumbered artifact body:\n"""\n${numbered.slice(0, 8000)}\n"""\n\nReturn findings as JSON.`,
  });

  return result.object.findings.map((finding) => ({
    artifactPath,
    line: finding.line,
    severity: finding.severity,
    ruleId: `llm:${finding.ruleId}`,
    message: finding.message,
  }));
}

export async function lintSpoilersHybrid({
  artifactPath,
  content,
  auditorProvider,
  auditorModelSlug,
}: {
  artifactPath: string;
  content: string;
  auditorProvider?: string;
  auditorModelSlug?: string;
}): Promise<SpoilerFinding[]> {
  const regexFindings = lintSpoilers({ artifactPath, content });
  if (!auditorProvider || !auditorModelSlug) {
    return regexFindings;
  }

  let llmFindings: SpoilerFinding[] = [];
  try {
    llmFindings = await lintSpoilersWithLlm({
      artifactPath,
      content,
      auditorProvider,
      auditorModelSlug,
    });
  } catch (error) {
    console.warn("spoiler-lint llm pass failed", error);
  }

  const seen = new Set<string>();
  return [...regexFindings, ...llmFindings].filter((finding) => {
    const key = `${finding.line}:${finding.ruleId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
