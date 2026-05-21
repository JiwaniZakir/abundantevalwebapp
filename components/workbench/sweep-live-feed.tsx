"use client";

import { Loader2 } from "lucide-react";
import { useWorkbench } from "@/lib/workbench/store";
import { cn } from "@/lib/utils";

export function SweepLiveFeed() {
  const trials = useWorkbench((s) => s.sweepTrialsLive);
  const isStreaming = useWorkbench((s) => s.isStreaming);

  if (trials.length === 0 && !isStreaming) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-3 space-y-2">
      <p className="text-micro font-medium uppercase tracking-wider text-[var(--fg-muted)]">Live sweep</p>
      {trials.length === 0 && isStreaming && (
        <p className="flex items-center gap-2 text-[12px] text-[var(--fg-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for trials…
        </p>
      )}
      {trials.map((t) => (
        <div key={t.idx} className="flex items-center justify-between text-[12px]">
          <span className="text-[var(--fg-secondary)]">Trial {t.idx}</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              t.status === "running" && "bg-[var(--amber-soft)] text-[var(--amber)]",
              t.status === "passed" && "bg-[var(--green-soft)] text-[var(--green)]",
              t.status === "failed" && "bg-[var(--red-soft)] text-[var(--red)]",
              t.status === "queued" && "bg-[var(--bg-hover)] text-[var(--fg-muted)]",
            )}
          >
            {t.status} {t.reward !== undefined ? `(reward ${t.reward})` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
