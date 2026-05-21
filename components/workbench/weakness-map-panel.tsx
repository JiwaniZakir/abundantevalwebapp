"use client";

import { useMemo, useState } from "react";
import { useWorkbench } from "@/lib/workbench/store";
import { Section } from "./ui/section";
import { cn } from "@/lib/utils";

export function WeaknessMapPanel() {
  const report = useWorkbench((s) => s.weaknessReport);
  const approve = useWorkbench((s) => s.approveWeaknessCandidates);
  const reject = useWorkbench((s) => s.rejectWeaknessCandidates);
  const sendInput = useWorkbench((s) => s.sendInput);
  const isStreaming = useWorkbench((s) => s.isStreaming);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const candidates = report?.candidates ?? [];

  const approvedSlugs = useMemo(
    () => candidates.filter((c) => c.status === "approved").map((c) => c.slug),
    [candidates],
  );

  if (!report) {
    return (
      <div className="p-4">
        <Section
          title="Weakness map"
          description="Run /weakness with a workflow description to generate 5–10 ranked candidates."
        />
      </div>
    );
  }

  const toggle = (slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  return (
    <div className="p-4 space-y-4">
      <Section
        eyebrow="Candidates"
        title="Weakness map"
        description={report.workflowDescription}
      />
      <div className="space-y-2">
        {candidates.map((c, i) => (
          <label
            key={c.slug}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-3 py-3 cursor-pointer transition-colors",
              c.status === "approved" && "border-[var(--green-soft)] bg-[var(--green-soft)]",
              c.status === "rejected" && "opacity-45",
              c.status === "candidate" && "border-[var(--border)] hover:bg-[var(--bg-hover)]",
            )}
          >
            <input
              type="checkbox"
              checked={selected.has(c.slug) || c.status === "approved"}
              onChange={() => toggle(c.slug)}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <p className="text-body font-medium text-[var(--fg)]">
                {i + 1}. {c.weaknessTitle}
              </p>
              <p className="text-micro text-[var(--fg-muted)] mt-1">
                {c.taxonomySlug} · fit {Math.round(c.workflowFitScore * 100)}%
              </p>
            </div>
          </label>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={isStreaming || approvedSlugs.length === 0}
          onClick={() => {
            const approved = candidates.filter((c) => c.status === "approved");
            void sendInput(
              `/probe batch\n\n${JSON.stringify(
                approved.map((c) => ({
                  slug: c.slug,
                  weaknessTitle: c.weaknessTitle,
                  deliverable: c.deliverable,
                  badHeuristic: c.badHeuristic,
                  authorityInvariant: c.authorityInvariant,
                })),
              )}`,
            );
          }}
          className="w-full rounded-xl bg-[var(--accent)] px-3 py-2.5 text-caption font-medium text-white disabled:opacity-40"
        >
          Probe approved at scale
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isStreaming || selected.size === 0}
            onClick={() => approve([...selected])}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-caption disabled:opacity-40"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={isStreaming || selected.size === 0}
            onClick={() => reject([...selected])}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-caption disabled:opacity-40"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
