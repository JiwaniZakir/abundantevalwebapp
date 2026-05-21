"use client";

import { AlertTriangle, Check, Circle, RefreshCw } from "lucide-react";
import { useWorkbench, type ResultSurface } from "@/lib/workbench/store";
import { cn } from "@/lib/utils";

type CheckStatus = "done" | "stale" | "empty" | "fail";

type CheckItem = {
  id: string;
  label: string;
  status: CheckStatus;
  detail?: string;
  action?: { label: string; command: string };
};

function statusIcon(status: CheckStatus) {
  switch (status) {
    case "done": return <Check className="h-3.5 w-3.5 text-[var(--green)]" />;
    case "stale": return <RefreshCw className="h-3.5 w-3.5 text-[var(--amber)]" />;
    case "fail": return <AlertTriangle className="h-3.5 w-3.5 text-[var(--red)]" />;
    case "empty": return <Circle className="h-3.5 w-3.5 text-[var(--fg-faint)]" />;
  }
}

export function TaskHealthChecklist() {
  const workspace = useWorkbench((s) => s.workspace);
  const probeSummary = useWorkbench((s) => s.probeSummary);
  const sweepSummary = useWorkbench((s) => s.sweepSummary);
  const spoilerFindings = useWorkbench((s) => s.spoilerFindings);
  const audit = useWorkbench((s) => s.audit);
  const resultsAvailable = useWorkbench((s) => s.resultsAvailable);
  const resultTimestamps = useWorkbench((s) => s.resultTimestamps);
  const sendInput = useWorkbench((s) => s.sendInput);
  const isStreaming = useWorkbench((s) => s.isStreaming);

  const maxArtifactUpdatedAt = Math.max(
    0,
    ...Object.values(workspace.artifacts).map((a) => a.updatedAt ?? 0),
  );

  function isStale(surface: ResultSurface): boolean {
    const ts = resultTimestamps[surface];
    if (!ts || maxArtifactUpdatedAt <= ts) return false;
    return resultsAvailable[surface];
  }

  const hasWeakness = Object.keys(workspace.artifacts).some((p) => p.startsWith("weakness/"));
  const hasInstruction = !!workspace.artifacts["instruction.md"];
  const hasFixtures = Object.keys(workspace.artifacts).some((p) => p.includes("build_inputs") || p.includes("fixtures"));

  const probeOk = probeSummary?.verdict === "promote";
  const probeRate = probeSummary ? Math.round(probeSummary.variants.reduce((a, v) => a + v.failureRate, 0) / probeSummary.variants.length * 100) : 0;
  const probeStale = isStale("probe");

  const oraclePasses = sweepSummary?.trials.every((t) => t.status === "passed");
  const targetFails = sweepSummary?.trials.every((t) => t.status === "failed");
  const sweepStale = isStale("sweep");
  const spoilerClean = spoilerFindings.length === 0;
  const spoilerStale = isStale("spoilers");
  const auditValid = audit && audit.classification !== "task_design_bug" && audit.classification !== "environment_failure";
  const auditStale = isStale("audit");

  const checks: CheckItem[] = [
    { id: "weakness", label: "Weakness hypothesis", status: hasWeakness ? "done" : "empty", detail: hasWeakness ? "Documented" : undefined, action: hasWeakness ? undefined : { label: "Map", command: "/weakness" } },
    { id: "probe", label: "Probe > 80%", status: !resultsAvailable.probe ? "empty" : probeStale ? "stale" : probeOk ? "done" : "fail", detail: resultsAvailable.probe ? (probeStale ? "Re-run after edits" : `${probeRate}% fail`) : undefined, action: !resultsAvailable.probe || probeStale ? { label: probeStale ? "Re-run" : "Run", command: "/probe" } : undefined },
    { id: "instruction", label: "Instruction", status: hasInstruction ? "done" : "empty", action: hasInstruction ? undefined : { label: "Scaffold", command: "/scaffold" } },
    { id: "spoilers", label: "Spoiler lint", status: !hasInstruction ? "empty" : spoilerStale ? "stale" : spoilerClean ? "done" : "fail", detail: spoilerStale ? "Re-lint after edits" : spoilerClean ? "Clean" : `${spoilerFindings.length} issue${spoilerFindings.length === 1 ? "" : "s"}`, action: !spoilerClean || spoilerStale ? { label: "Lint", command: "/lint" } : undefined },
    { id: "fixtures", label: "Fixtures", status: hasFixtures ? "done" : "empty", action: hasFixtures ? undefined : { label: "Gen", command: "/fixtures" } },
    { id: "oracle", label: "Oracle = 1", status: !resultsAvailable.sweep ? "empty" : sweepStale ? "stale" : oraclePasses ? "done" : "fail", action: !resultsAvailable.sweep || sweepStale ? { label: sweepStale ? "Re-run" : "Run", command: "/sweep oracle" } : undefined },
    { id: "target", label: "Target pass@3 = 0", status: !resultsAvailable.sweep ? "empty" : sweepStale ? "stale" : targetFails ? "done" : "fail", action: !resultsAvailable.sweep || sweepStale ? { label: sweepStale ? "Re-run" : "Run", command: "/sweep target" } : undefined },
    { id: "audit", label: "Audit valid", status: !resultsAvailable.audit ? "empty" : auditStale ? "stale" : auditValid ? "done" : "fail", detail: audit ? audit.classification.replace(/_/g, " ") : undefined, action: !resultsAvailable.audit || auditStale ? { label: auditStale ? "Re-run" : "Run", command: "/audit" } : undefined },
  ];

  const doneCount = checks.filter((c) => c.status === "done").length;
  const progress = Math.round((doneCount / checks.length) * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-semibold text-[var(--fg)]">{doneCount} of {checks.length}</p>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-[var(--bg-active)] overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-[var(--green)]" : "bg-[var(--accent)]")}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="mono text-[11px] text-[var(--fg-faint)]">{progress}%</span>
        </div>
      </div>

      <div className="space-y-0.5">
        {checks.map((check) => (
          <div key={check.id} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-[var(--bg-hover)] transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              {statusIcon(check.status)}
              <span className={cn(
                "text-[12px]",
                check.status === "done" && "text-[var(--fg-secondary)]",
                check.status === "empty" && "text-[var(--fg-muted)]",
                check.status === "fail" && "text-[var(--fg)] font-medium",
                check.status === "stale" && "text-[var(--amber)]",
              )}>
                {check.label}
              </span>
              {check.detail && (
                <span className="text-[11px] text-[var(--fg-faint)] truncate">{check.detail}</span>
              )}
            </div>
            {check.action && (
              <button
                type="button"
                disabled={isStreaming}
                onClick={() => void sendInput(check.action!.command)}
                className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-30 transition-colors"
              >
                {check.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
