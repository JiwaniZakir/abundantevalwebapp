import type { DecisionReportEntry, ProbeSummary } from "@/lib/agent/types";

export function buildDecisionReportEntries(
  summaries: ProbeSummary[],
): DecisionReportEntry[] {
  return summaries.map((s) => {
    const aggregateFailureRate =
      s.variants.reduce((acc, v) => acc + v.failureRate, 0) /
      Math.max(1, s.variants.length);
    return {
      slug: s.weaknessTitle
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48),
      weaknessTitle: s.weaknessTitle,
      verdict: s.verdict,
      aggregateFailureRate,
      recommendedAction:
        s.verdict === "promote"
          ? "Scaffold Harbor task pack and run oracle/nop/target sweeps."
          : s.verdict === "redesign"
            ? "Tighten bait/fixtures and re-probe before scaffold."
            : "Reject or reframe weakness hypothesis.",
    };
  });
}

export function renderDecisionReportMarkdown(entries: DecisionReportEntry[]): string {
  const lines = [
    "# Probe decision report",
    "",
    "| Weakness | Verdict | Fail rate | Next action |",
    "|----------|---------|-----------|-------------|",
  ];
  for (const e of entries) {
    lines.push(
      `| ${e.weaknessTitle} | ${e.verdict} | ${Math.round(e.aggregateFailureRate * 100)}% | ${e.recommendedAction} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}
