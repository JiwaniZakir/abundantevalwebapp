import { z } from "zod";

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
