"use client";

import type { AuditSummary } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

export function TrajectoryPanel({ audit }: { audit: AuditSummary }) {
  const steps = audit.steps ?? [];

  if (steps.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-3 text-[12px] text-[var(--fg-muted)]">
        {audit.rationale}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Trajectory</p>
      {steps.map((step) => (
        <div
          key={step.id}
          className={cn(
            "rounded-lg border px-3 py-2 text-[12px]",
            step.failed ? "border-[var(--red-soft)] bg-[var(--red-soft)]" : "border-[var(--border)] bg-white",
          )}
        >
          <p className="font-medium text-[var(--fg)]">{step.label}</p>
          {step.excerpt && (
            <p className="mt-1 text-[var(--fg-muted)] line-clamp-3">{step.excerpt}</p>
          )}
        </div>
      ))}
    </div>
  );
}
