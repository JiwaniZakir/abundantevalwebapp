"use client";

import { ChevronRight, Loader2, Check, XCircle } from "lucide-react";
import { useState } from "react";
import type { ToolCall } from "@/lib/agent/types";
import { useWorkbench } from "@/lib/workbench/store";
import { cn } from "@/lib/utils";

const labels: Record<ToolCall["name"], string> = {
  list_workspace: "List workspace",
  read_artifact: "Read artifact",
  write_artifact: "Write artifact",
  intake_workflow: "Intake workflow",
  map_workflow_weaknesses: "Map weaknesses",
  batch_probe_candidates: "Batch probe",
  render_probe_decision_report: "Decision report",
  run_probe_variants: "Run probes",
  lint_spoilers: "Lint spoilers",
  generate_fixtures: "Generate fixtures",
  scaffold_task: "Scaffold task",
  run_harbor_sweep: "Harbor sweep",
  audit_trajectory: "Audit trajectory",
  propose_iteration: "Propose iteration",
  set_phase: "Set phase",
};

function durationMs(call: ToolCall) {
  if (!call.finishedAt) return null;
  return call.finishedAt - call.startedAt;
}

export function ToolCallCard({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const setFocus = useWorkbench((s) => s.setFocus);
  const isRunning = call.status === "running";
  const isFailed = call.status === "failed";
  const ms = durationMs(call);

  return (
    <div className={cn(
      "rounded-lg border text-[12px]",
      isFailed ? "border-[var(--red-soft)] bg-[var(--red-soft)]" : "border-[var(--border)] bg-[var(--bg-muted)]",
    )}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2">
          {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--fg-muted)]" />}
          {isFailed && <XCircle className="h-3.5 w-3.5 text-[var(--red)]" />}
          {!isRunning && !isFailed && <Check className="h-3.5 w-3.5 text-[var(--green)]" />}
          <span className="font-medium text-[var(--fg-secondary)]">{labels[call.name] ?? call.name}</span>
          {ms !== null && <span className="text-[10px] text-[var(--fg-faint)]">{(ms / 1000).toFixed(1)}s</span>}
        </span>
        <span className="flex items-center gap-1.5 text-[var(--fg-faint)]">
          {call.summary && !open && <span className="max-w-[8rem] truncate text-[11px]">{call.summary}</span>}
          <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
        </span>
      </button>
      {open && (
        <div className="border-t border-[var(--border)] px-3 py-2 space-y-1">
          {Object.entries(call.args).map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-2 text-[11px]">
              <span className="mono text-[var(--fg-faint)] shrink-0">{k}</span>
              <span className="mono text-[var(--fg-muted)] truncate">{typeof v === "string" ? v : JSON.stringify(v).slice(0, 200)}</span>
            </div>
          ))}
          {call.summary && <p className="text-[11px] text-[var(--fg-muted)] mt-1">{call.summary}</p>}
          {call.name === "run_harbor_sweep" && (
            <button type="button" onClick={() => setFocus({ kind: "result", result: "sweep" })} className="text-[11px] text-[var(--accent)] mt-1">
              View sweep results
            </button>
          )}
          {call.result !== undefined && (
            <pre className="mt-2 max-h-32 overflow-auto rounded bg-white p-2 text-[10px] mono text-[var(--fg-muted)]">
              {JSON.stringify(call.result, null, 2).slice(0, 1200)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
