"use client";

import { Check, Circle, Loader2 } from "lucide-react";
import type { AgentPhase } from "@/lib/agent/types";
import { productStages, stageForPhase } from "@/lib/agent/stages";
import { useWorkbench } from "@/lib/workbench/store";
import type { ResultSurface } from "@/lib/workbench/store";
import { cn } from "@/lib/utils";
import { Section } from "./ui/section";

function stageComplete(
  stageId: (typeof productStages)[number]["id"],
  results: Record<ResultSurface, boolean>,
  phase: AgentPhase,
): boolean {
  switch (stageId) {
    case "intake":
      return phase !== "intake" || results.probe;
    case "probe":
      return results.probe;
    case "build":
      return results.sweep || phase === "sweep" || phase === "audit" || phase === "publish";
    case "validate":
      return results.sweep && results.audit;
    case "publish":
      return phase === "publish";
    default:
      return false;
  }
}

export function PipelineDashboard() {
  const phase = useWorkbench((s) => s.workspace.phase);
  const results = useWorkbench((s) => s.resultsAvailable);
  const isStreaming = useWorkbench((s) => s.isStreaming);
  const weaknessReport = useWorkbench((s) => s.weaknessReport);
  const probeSummaries = useWorkbench((s) => s.probeSummaries);
  const autopilotActive = useWorkbench((s) => s.autopilotActive);
  const autopilotMessage = useWorkbench((s) => s.autopilotMessage);
  const pendingApproval = useWorkbench((s) => s.pendingApproval);
  const current = stageForPhase(phase);

  const approvedCount =
    weaknessReport?.candidates.filter((c) => c.status === "approved").length ?? 0;
  const candidateCount = weaknessReport?.candidates.length ?? 0;

  return (
    <div className="space-y-6 p-4">
      <Section
        eyebrow="Workflow"
        title="Eval pipeline"
        description="Autopilot runs each stage — approve at gates to continue."
      />

      {(autopilotActive || pendingApproval) && autopilotMessage && (
        <div className="rounded-xl border border-[var(--accent-strong)] bg-[var(--accent-soft)] px-3 py-2.5">
          <p className="text-micro uppercase tracking-wider text-[var(--accent)]">
            {pendingApproval ? "Awaiting approval" : isStreaming ? "Running" : "Paused"}
          </p>
          <p className="mt-1 text-caption text-[var(--fg-secondary)] leading-snug">{autopilotMessage}</p>
        </div>
      )}

      <ol className="space-y-2">
        {productStages.map((stage, i) => {
          const active = stage.id === current;
          const done = stageComplete(stage.id, results, phase);
          return (
            <li
              key={stage.id}
              className={cn(
                "flex gap-3 rounded-xl border px-3 py-3 transition-colors",
                active && "border-[var(--accent-strong)] bg-[var(--accent-soft)]",
                !active && done && "border-[var(--border)] bg-[var(--bg)]",
                !active && !done && "border-[var(--border)] bg-[var(--bg-muted)] opacity-80",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  active && "bg-[var(--accent)] text-white",
                  done && !active && "bg-[var(--green-soft)] text-[var(--green)]",
                  !done && !active && "bg-[var(--bg-active)] text-[var(--fg-muted)]",
                )}
              >
                {done && !active ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-body font-medium text-[var(--fg)]">{stage.label}</p>
                  {active && isStreaming && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
                  )}
                </div>
                <p className="mt-0.5 text-caption text-[var(--fg-muted)] leading-snug">
                  {stage.description}
                </p>
                {stage.id === "intake" && candidateCount > 0 && (
                  <p className="mt-1.5 text-micro text-[var(--fg-secondary)]">
                    {candidateCount} candidates · {approvedCount} approved
                  </p>
                )}
                {stage.id === "probe" && probeSummaries.length > 0 && (
                  <p className="mt-1.5 text-micro text-[var(--fg-secondary)]">
                    {probeSummaries.length} probe run{probeSummaries.length === 1 ? "" : "s"} logged
                  </p>
                )}
              </div>
              {!done && !active && <Circle className="mt-1 h-3 w-3 shrink-0 text-[var(--fg-faint)]" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
