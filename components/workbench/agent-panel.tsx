"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useWorkbench } from "@/lib/workbench/store";
import type { FocusTarget } from "@/lib/workbench/store";
import { TaskHealthChecklist } from "./task-health";
import { WeaknessMapPanel } from "./weakness-map-panel";
import { PipelineDashboard } from "./pipeline-dashboard";
import { BenchmarkStudio } from "./benchmark-studio";
import { TrajectoryPanel } from "./trajectory-panel";
import { CodeView } from "./code-view";
import {
  AuditCard,
  CascadeInsightCard,
  IterationDiffCard,
  ProbeResultCard,
  SpoilerFindingsCard,
  SweepResultCard,
} from "./result-cards";
import { cn } from "@/lib/utils";

type Tab = "studio" | "map" | "health";

function TabButton({ active, label, badge, onClick }: { active: boolean; label: string; badge?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2.5 text-caption font-medium transition-colors border-b-2 -mb-px",
        active
          ? "border-[var(--fg)] text-[var(--fg)]"
          : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]",
      )}
    >
      {label}
      {badge && (
        <span className="rounded-full bg-[var(--amber-soft)] px-1.5 py-px text-micro font-medium text-[var(--amber)]">
          {badge}
        </span>
      )}
    </button>
  );
}

function FocusOverlay({ focus }: { focus: Extract<FocusTarget, { kind: "artifact" | "result" }> }) {
  const workspace = useWorkbench((s) => s.workspace);
  const setFocus = useWorkbench((s) => s.setFocus);
  const spoilerFindings = useWorkbench((s) => s.spoilerFindings);
  const audit = useWorkbench((s) => s.audit);

  const label =
    focus.kind === "artifact"
      ? focus.path
      : focus.result.replace(/_/g, " ");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
        <button
          type="button"
          onClick={() => setFocus({ kind: "none" })}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-caption text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Studio
        </button>
        <span className="mono text-micro text-[var(--fg-faint)] truncate">{label}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {focus.kind === "artifact" && workspace.artifacts[focus.path] && (
          <CodeView
            content={workspace.artifacts[focus.path].content}
            kind={workspace.artifacts[focus.path].kind}
            findings={spoilerFindings.filter((f) => f.artifactPath === focus.path)}
          />
        )}
        {focus.kind === "artifact" && !workspace.artifacts[focus.path] && (
          <div className="flex h-32 items-center justify-center">
            <p className="text-caption text-[var(--fg-faint)]">Not found</p>
          </div>
        )}
        {focus.kind === "result" && focus.result === "probe" && <ProbeResultCard />}
        {focus.kind === "result" && focus.result === "sweep" && <SweepResultCard />}
        {focus.kind === "result" && focus.result === "cascade" && <CascadeInsightCard />}
        {focus.kind === "result" && focus.result === "audit" && (
          <>
            <AuditCard />
            {audit && (
              <div className="px-4 pb-4">
                <TrajectoryPanel audit={audit} />
              </div>
            )}
          </>
        )}
        {focus.kind === "result" && focus.result === "iteration" && <IterationDiffCard />}
        {focus.kind === "result" && focus.result === "spoilers" && <SpoilerFindingsCard />}
      </div>
    </div>
  );
}

function QuickResults() {
  const results = useWorkbench((s) => s.resultsAvailable);
  const setFocus = useWorkbench((s) => s.setFocus);
  const probeSummary = useWorkbench((s) => s.probeSummary);
  const sweepSummary = useWorkbench((s) => s.sweepSummary);

  const items = [
    { key: "probe", label: "Probe", available: results.probe, detail: probeSummary?.verdict, result: "probe" as const },
    { key: "sweep", label: "Sweep", available: results.sweep, detail: sweepSummary?.passAt3, result: "sweep" as const },
    { key: "audit", label: "Audit", available: results.audit, detail: undefined, result: "audit" as const },
  ].filter((i) => i.available);

  if (items.length === 0) return null;

  return (
    <div className="border-t border-[var(--border)] px-4 py-3 space-y-1">
      <p className="text-micro text-[var(--fg-muted)] mb-2">Quick open</p>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => setFocus({ kind: "result", result: item.result })}
          className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-[var(--bg-hover)]"
        >
          <span className="text-caption font-medium text-[var(--fg-secondary)]">{item.label}</span>
          <span className="flex items-center gap-1 text-micro text-[var(--fg-faint)]">
            {item.detail}
            <ChevronRight className="h-3 w-3" />
          </span>
        </button>
      ))}
    </div>
  );
}

export function AgentPanel() {
  const [tab, setTab] = useState<Tab>("studio");
  const focus = useWorkbench((s) => s.focus);
  const results = useWorkbench((s) => s.resultsAvailable);
  const resultTimestamps = useWorkbench((s) => s.resultTimestamps);
  const workspace = useWorkbench((s) => s.workspace);
  const weaknessReport = useWorkbench((s) => s.weaknessReport);
  const autopilotActive = useWorkbench((s) => s.autopilotActive);
  const probeSummaries = useWorkbench((s) => s.probeSummaries);
  const isStreaming = useWorkbench((s) => s.isStreaming);

  useEffect(() => {
    if (autopilotActive && isStreaming) setTab("studio");
  }, [autopilotActive, isStreaming]);

  useEffect(() => {
    if (autopilotActive && weaknessReport?.candidates.length) setTab("map");
  }, [autopilotActive, weaknessReport?.candidates.length]);

  useEffect(() => {
    if (autopilotActive && probeSummaries.length > 0) setTab("studio");
  }, [autopilotActive, probeSummaries.length]);

  const overlay = focus.kind === "artifact" || focus.kind === "result";

  const maxArtifactUpdatedAt = Math.max(
    0,
    ...Object.values(workspace.artifacts).map((a) => a.updatedAt ?? 0),
  );
  const stale = (["probe", "sweep"] as const).some((key) => {
    const ts = resultTimestamps[key];
    return ts && maxArtifactUpdatedAt > ts && results[key];
  });

  const mapBadge = weaknessReport?.candidates.length
    ? String(weaknessReport.candidates.filter((c) => c.status === "approved").length || weaknessReport.candidates.length)
    : undefined;

  if (overlay) {
    return (
      <aside className="flex h-full w-[400px] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--bg-surface)]">
        <FocusOverlay focus={focus} />
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[400px] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="flex items-center border-b border-[var(--border)] px-1">
        <TabButton active={tab === "studio"} label="Studio" onClick={() => setTab("studio")} />
        <TabButton active={tab === "map"} label="Map" badge={mapBadge} onClick={() => setTab("map")} />
        <TabButton active={tab === "health"} label="Health" badge={stale ? "stale" : undefined} onClick={() => setTab("health")} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "studio" && (
          <>
            <PipelineDashboard />
            <div className="border-t border-[var(--border)]">
              <BenchmarkStudio />
            </div>
            <QuickResults />
          </>
        )}
        {tab === "map" && <WeaknessMapPanel />}
        {tab === "health" && (
          <div className="p-4">
            <TaskHealthChecklist />
          </div>
        )}
      </div>
    </aside>
  );
}
