"use client";

import { Check, X } from "lucide-react";
import type { ApprovalGate } from "@/lib/agent/types";
import { useWorkbench } from "@/lib/workbench/store";

export function ApprovalGateCard({ gate }: { gate: ApprovalGate }) {
  const respondToApproval = useWorkbench((s) => s.respondToApproval);
  const isStreaming = useWorkbench((s) => s.isStreaming);

  return (
    <div className="mx-auto max-w-[680px] px-5 py-3 animate-fade-in">
      <div className="rounded-2xl border border-[var(--accent-strong)] bg-[var(--accent-soft)] p-4 shadow-sm">
        <p className="text-micro uppercase tracking-wider text-[var(--accent)]">Approval required</p>
        <h3 className="mt-1 text-title text-[var(--fg)]">{gate.title}</h3>
        <p className="mt-2 text-body text-[var(--fg-secondary)] leading-relaxed">{gate.description}</p>
        {gate.candidateCount !== undefined && (
          <p className="mt-2 text-caption text-[var(--fg-muted)]">{gate.candidateCount} weakness candidates mapped</p>
        )}
        {gate.taskSlug && (
          <p className="mt-1 mono text-caption text-[var(--fg-muted)]">task/{gate.taskSlug}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isStreaming}
            onClick={() => void respondToApproval("approve")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-caption font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" />
            Approve & continue
          </button>
          <button
            type="button"
            disabled={isStreaming}
            onClick={() => void respondToApproval("reject")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg)] px-4 py-2 text-caption font-medium text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" />
            Pause
          </button>
        </div>
      </div>
    </div>
  );
}
