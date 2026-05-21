"use client";

import { useMemo } from "react";
import { useWorkbench } from "@/lib/workbench/store";
import { Section, MetricCard } from "./ui/section";
import { ProbeScaleViz } from "./probe-scale-viz";
import { SweepLiveFeed } from "./sweep-live-feed";
import { cn } from "@/lib/utils";

function SweepBenchmark() {
  const summary = useWorkbench((s) => s.sweepSummary);
  const targetModel = useWorkbench((s) => s.workspace.targetModel);

  if (!summary) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-strong)] p-5 text-center">
        <p className="text-body text-[var(--fg-muted)]">Harbor sweep pending</p>
        <p className="mt-1 text-caption text-[var(--fg-faint)]">Oracle → nop → target pass@3</p>
      </div>
    );
  }

  const passes = summary.trials.filter((t) => t.status === "passed").length;
  const passTone = passes === 0 ? "good" : passes < summary.trials.length ? "warn" : "bad";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Target model" value={targetModel.split("/").pop() ?? targetModel} />
        <MetricCard label="pass@3" value={summary.passAt3} tone={passTone} hint="Want 0/3 for hard eval" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {summary.trials.map((t) => (
          <div
            key={t.idx}
            className={cn(
              "rounded-xl border p-3 text-center",
              t.status === "passed" ? "border-[var(--green-soft)] bg-[var(--green-soft)]" : "border-[var(--border)] bg-[var(--bg)]",
            )}
          >
            <p className="text-micro text-[var(--fg-muted)]">Trial {t.idx}</p>
            <p className={cn("mt-1 text-display tabular-nums", t.status === "passed" ? "text-[var(--green)]" : "text-[var(--fg)]")}>
              {t.reward.toFixed(1)}
            </p>
            <p className="mt-0.5 text-micro capitalize text-[var(--fg-faint)]">{t.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DecisionQueue() {
  const entries = useWorkbench((s) => s.decisionReport);
  if (entries.length === 0) return null;

  return (
    <Section eyebrow="Decision" title="Probe verdicts" description="Promote, redesign, or reject per candidate.">
      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.slug} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-body font-medium text-[var(--fg)] truncate">{e.weaknessTitle}</p>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-micro font-medium uppercase",
                  e.verdict === "promote" && "bg-[var(--green-soft)] text-[var(--green)]",
                  e.verdict === "redesign" && "bg-[var(--amber-soft)] text-[var(--amber)]",
                  e.verdict === "reject" && "bg-[var(--red-soft)] text-[var(--red)]",
                )}
              >
                {e.verdict}
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-active)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${Math.round(e.aggregateFailureRate * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-micro text-[var(--fg-muted)]">
              {Math.round(e.aggregateFailureRate * 100)}% failure · {e.recommendedAction}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function BenchmarkStudio() {
  const probeSummary = useWorkbench((s) => s.probeSummary);
  const probeSummaries = useWorkbench((s) => s.probeSummaries);
  const isStreaming = useWorkbench((s) => s.isStreaming);
  const messages = useWorkbench((s) => s.messages);

  const batchRunning = useMemo(() => {
    if (!isStreaming) return false;
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    return last?.toolCalls?.some(
      (t) =>
        (t.name === "batch_probe_candidates" || t.name === "run_probe_variants") &&
        t.status === "running",
    );
  }, [isStreaming, messages]);

  return (
    <div className="space-y-6 p-4">
      <Section
        eyebrow="Benchmarks"
        title="Model performance"
        description="Live probe pressure and Harbor sweep results for your target model."
      />

      {batchRunning && (
        <div className="rounded-xl border border-[var(--accent-strong)] bg-[var(--accent-soft)] px-3 py-2.5 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <p className="text-caption text-[var(--fg-secondary)]">Batch probe in progress…</p>
        </div>
      )}

      <Section title="Probe at scale" description="5 variants × 15 trials per weakness.">
        <ProbeScaleViz summary={probeSummary} summaries={probeSummaries} />
      </Section>

      <DecisionQueue />

      <Section title="Harbor validation">
        <SweepLiveFeed />
        <div className="mt-3">
          <SweepBenchmark />
        </div>
      </Section>
    </div>
  );
}
