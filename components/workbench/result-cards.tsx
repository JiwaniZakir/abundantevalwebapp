"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { useWorkbench } from "@/lib/workbench/store";
import { ds25DependencyEdges } from "@/lib/domain/ds25-seed";
import { ProbeMatrix } from "./probe-matrix";
import { SweepLiveFeed } from "./sweep-live-feed";
import { cn } from "@/lib/utils";

function Panel({ eyebrow, title, trailing, children }: { eyebrow: string; title: string; trailing?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[720px] px-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-muted)]">{eyebrow}</p>
          <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-[var(--fg)]">{title}</h2>
        </div>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ label, variant }: { label: string; variant: "green" | "amber" | "red" | "default" }) {
  const colors = {
    green: "bg-[var(--green-soft)] text-[var(--green)]",
    amber: "bg-[var(--amber-soft)] text-[var(--amber)]",
    red: "bg-[var(--red-soft)] text-[var(--red)]",
    default: "bg-[var(--bg-muted)] text-[var(--fg-secondary)]",
  };
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium", colors[variant])}>{label}</span>;
}

function NextStep({ label, desc, onClick }: { label: string; desc: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-5 flex w-full items-center justify-between gap-3 rounded-lg bg-[var(--accent)] px-4 py-3.5 text-left text-white transition-opacity hover:opacity-90">
      <span>
        <span className="text-[13px] font-medium">{label}</span>
        <span className="mt-0.5 block text-[12px] opacity-70">{desc}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </button>
  );
}

function Empty({ eyebrow, title, hint, action }: { eyebrow: string; title: string; hint: string; action?: { label: string; onClick: () => void } }) {
  return (
    <Panel eyebrow={eyebrow} title={title}>
      <div className="rounded-lg border border-dashed border-[var(--border-strong)] p-6 text-center">
        <p className="text-[13px] text-[var(--fg-secondary)]">{hint}</p>
        {action && (
          <button type="button" onClick={action.onClick} className="mt-3 rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-white">
            {action.label}
          </button>
        )}
      </div>
    </Panel>
  );
}

export function ProbeResultCard() {
  const summary = useWorkbench((s) => s.probeSummary);
  const sendInput = useWorkbench((s) => s.sendInput);
  const [view, setView] = useState<"bars" | "matrix">("bars");
  if (!summary) return <Empty eyebrow="Probe" title="No probe results yet" hint="Run /probe to pressure the weakness with 5 variants." action={{ label: "Run /probe", onClick: () => void sendInput("/probe") }} />;

  const agg = summary.variants.reduce((a, v) => a + v.failureRate, 0) / Math.max(1, summary.variants.length);
  const tone = summary.verdict === "promote" ? "green" : summary.verdict === "redesign" ? "amber" : "red";

  return (
    <Panel eyebrow="Probe verdict" title={summary.weaknessTitle} trailing={<StatusBadge label={summary.verdict} variant={tone as "green" | "amber" | "red"} />}>
      <div className="rounded-lg border border-[var(--border)] p-5">
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-muted)]">Failure rate</p>
            <p className="mt-1 text-[36px] font-semibold tracking-tighter leading-none">{Math.round(agg * 100)}<span className="text-[16px] text-[var(--fg-muted)]">%</span></p>
          </div>
          <p className="text-[12px] text-[var(--fg-muted)]">{summary.variants.length} variants · {summary.variants[0]?.trials ?? 0} trials each</p>
          <div className="flex gap-1">
            <button type="button" onClick={() => setView("bars")} className={cn("rounded px-2 py-0.5 text-[11px]", view === "bars" && "bg-[var(--bg-active)]")}>Bars</button>
            <button type="button" onClick={() => setView("matrix")} className={cn("rounded px-2 py-0.5 text-[11px]", view === "matrix" && "bg-[var(--bg-active)]")}>Matrix</button>
          </div>
        </div>

        {view === "matrix" ? (
          <ProbeMatrix summary={summary} />
        ) : (
        <div className="space-y-2">
          {summary.variants.map((v) => (
            <div key={v.variant} className="flex items-center gap-3">
              <span className="mono w-20 text-[11px] text-[var(--fg-muted)] uppercase">{v.variant.replace("_", " ")}</span>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-active)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${v.failureRate * 100}%` }} />
              </div>
              <span className="mono w-10 text-right text-[12px]">{Math.round(v.failureRate * 100)}%</span>
            </div>
          ))}
        </div>
        )}

        {summary.verdict === "promote" && <NextStep label="Scaffold the task pack" desc="Generate instruction, verifier, and fixtures." onClick={() => void sendInput("/scaffold")} />}
        {summary.verdict === "redesign" && <NextStep label="Tighten the bait" desc="Iterate on the weakness framing." onClick={() => void sendInput("/iterate")} />}
        {summary.verdict === "reject" && <NextStep label="Try a different weakness" desc="This framing is too easy for the target." onClick={() => void sendInput("/weakness")} />}
      </div>
    </Panel>
  );
}

export function SweepResultCard() {
  const summary = useWorkbench((s) => s.sweepSummary);
  const setFocus = useWorkbench((s) => s.setFocus);
  const sendInput = useWorkbench((s) => s.sendInput);
  const cascadeAvailable = useWorkbench((s) => s.resultsAvailable.cascade);

  if (!summary) return <Empty eyebrow="Sweep" title="No sweep yet" hint="Run /sweep oracle, /sweep nop, or /sweep target." action={{ label: "Sweep target", onClick: () => void sendInput("/sweep target") }} />;

  const passes = summary.trials.filter((t) => t.status === "passed").length;
  const tone = passes === 0 ? "red" : passes < summary.trials.length ? "amber" : "green";

  return (
    <Panel eyebrow="Harbor sweep" title={summary.taskSlug} trailing={<StatusBadge label={`pass@3 · ${summary.passAt3}`} variant={tone as "green" | "amber" | "red"} />}>
      <div className="mb-4">
        <SweepLiveFeed />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {summary.trials.map((t) => (
          <div key={t.idx} className="rounded-lg border border-[var(--border)] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-muted)]">Trial {t.idx}</span>
              {t.status === "passed" ? <CheckCircle2 className="h-3.5 w-3.5 text-[var(--green)]" /> : <XCircle className="h-3.5 w-3.5 text-[var(--red)]" />}
            </div>
            <p className="text-[28px] font-semibold tracking-tighter">{t.reward.toFixed(1)}</p>
            <p className="mt-1 text-[12px] text-[var(--fg-muted)] leading-relaxed">{t.summary}</p>
          </div>
        ))}
      </div>
      {passes === 0 && cascadeAvailable && <NextStep label="See why it's hard" desc="Inspect the dependency cascade." onClick={() => setFocus({ kind: "result", result: "cascade" })} />}
      {passes === 0 && !cascadeAvailable && <NextStep label="Audit the trajectory" desc="Classify the failure mode." onClick={() => void sendInput("/audit")} />}
    </Panel>
  );
}

export function CascadeInsightCard() {
  const summary = useWorkbench((s) => s.sweepSummary);
  const sendInput = useWorkbench((s) => s.sendInput);
  if (!summary?.cascade?.length) return <Empty eyebrow="Cascade" title="No cascade data" hint="Run a target sweep on a graph-heavy task first." />;

  const statusColor: Record<string, string> = { revoked: "var(--red)", blocked: "var(--amber)", conflict: "var(--amber)", active: "var(--green)", manual_review: "var(--blue)" };
  const isDs25 = summary.cascade.some((n) => n.id.startsWith("CERT-") || n.id.startsWith("LAB-"));

  return (
    <Panel eyebrow="Why it's hard" title="Revocation cascades through dependencies">
      <div className="grid gap-2 md:grid-cols-3">
        {summary.cascade.map((n) => (
          <div key={n.id} className="rounded-lg border border-[var(--border)] p-3">
            <p className="mono text-[10px] uppercase tracking-wider text-[var(--fg-muted)]">{n.id}</p>
            <p className="mt-1 text-[13px] font-medium">{n.label}</p>
            <span className="mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: `${statusColor[n.status] ?? "var(--fg-muted)"}15`, color: statusColor[n.status] ?? "var(--fg-muted)" }}>
              {n.status.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>
      {isDs25 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {ds25DependencyEdges.map(([from, to]) => (
            <span key={`${from}-${to}`} className="mono flex items-center gap-1 rounded border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--fg-muted)]">
              {from} <ArrowRight className="h-2.5 w-2.5" /> {to}
            </span>
          ))}
        </div>
      )}
      <NextStep label="Audit the failure" desc="Confirm this is a genuine model weakness." onClick={() => void sendInput("/audit")} />
    </Panel>
  );
}

export function AuditCard() {
  const audit = useWorkbench((s) => s.audit);
  const sendInput = useWorkbench((s) => s.sendInput);
  if (!audit) return <Empty eyebrow="Audit" title="No audit yet" hint="Run /audit after a target sweep." action={{ label: "Run /audit", onClick: () => void sendInput("/audit") }} />;

  return (
    <Panel eyebrow="Trajectory audit" title={audit.classification.replace(/_/g, " ")} trailing={<StatusBadge label="verified" variant="default" />}>
      <div className="rounded-lg border border-[var(--border)] p-5">
        <p className="text-[14px] leading-relaxed text-[var(--fg-secondary)]">{audit.rationale}</p>
        <p className="mt-4 mono text-[11px] text-[var(--fg-muted)]">auditor · {audit.auditorModel}</p>
      </div>
      <NextStep label="Propose an iteration" desc="Harden bait realism." onClick={() => void sendInput("/iterate")} />
    </Panel>
  );
}

export function SpoilerFindingsCard() {
  const findings = useWorkbench((s) => s.spoilerFindings);
  const openArtifact = useWorkbench((s) => s.openArtifact);

  if (findings.length === 0) {
    return (
      <Panel eyebrow="Spoiler lint" title="Clean" trailing={<StatusBadge label="no findings" variant="green" />}>
        <p className="text-[13px] text-[var(--fg-secondary)]">No spoilers detected. Re-run /lint after edits.</p>
      </Panel>
    );
  }

  const severityColor: Record<string, string> = { high: "var(--red)", medium: "var(--amber)", low: "var(--blue)" };

  return (
    <Panel eyebrow="Spoiler lint" title={`${findings.length} finding${findings.length === 1 ? "" : "s"}`}>
      <div className="space-y-1.5">
        {findings.map((f, i) => (
          <button
            key={`${f.artifactPath}-${f.line}-${i}`}
            type="button"
            onClick={() => openArtifact(f.artifactPath)}
            className="flex w-full items-start justify-between gap-3 rounded-lg border border-[var(--border)] p-3 text-left hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="rounded px-1 py-px font-medium" style={{ background: `${severityColor[f.severity]}15`, color: severityColor[f.severity] }}>{f.severity}</span>
                <span className="mono text-[var(--fg-muted)]">{f.artifactPath}:{f.line}</span>
              </div>
              <p className="mt-1 text-[12px] text-[var(--fg)]">{f.message}</p>
            </div>
            <ArrowRight className="mt-1 h-3 w-3 text-[var(--fg-faint)]" />
          </button>
        ))}
      </div>
    </Panel>
  );
}

export function IterationDiffCard() {
  const workspace = useWorkbench((s) => s.workspace);
  const latestPath = useWorkbench((s) => s.latestIterationPath);
  const setPublishOpen = useWorkbench((s) => s.setPublishOpen);
  const applyIteration = useWorkbench((s) => s.applyIteration);
  const openArtifact = useWorkbench((s) => s.openArtifact);
  const sendInput = useWorkbench((s) => s.sendInput);
  const artifact = latestPath ? workspace.artifacts[latestPath] : undefined;

  if (!artifact) return <Empty eyebrow="Iteration" title="No iteration drafted" hint="Run /iterate to propose a diff." action={{ label: "Run /iterate", onClick: () => void sendInput("/iterate") }} />;

  const lines = artifact.content.split("\n");
  const targetMatch = artifact.content.match(/^\+\+\+\s+b\/(.+)$/m);
  const targetPath = targetMatch?.[1]?.trim() ?? null;
  const beforeLines: string[] = [];
  const afterLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("- ")) beforeLines.push(line.slice(2));
    else if (line.startsWith("+ ")) afterLines.push(line.slice(2));
  }
  const before = beforeLines.join("\n");
  const after = afterLines.join("\n");
  const canApply = targetPath && before && after;
  const target = targetPath ? workspace.artifacts[targetPath] : null;
  const conflict = canApply && target ? !target.content.includes(before) : false;

  return (
    <Panel eyebrow="Iteration" title={latestPath ?? "diff"} trailing={
      <div className="flex items-center gap-2">
        {canApply && (
          <button type="button" onClick={() => {
            const r = applyIteration({ diffPath: latestPath!, targetPath: targetPath!, before, after });
            if (r.ok) openArtifact(targetPath!);
          }} disabled={conflict} className="rounded-md border border-[var(--border)] px-2.5 py-1 text-[12px] font-medium hover:bg-[var(--bg-subtle)] disabled:opacity-30 transition-colors">
            Apply
          </button>
        )}
        <button type="button" onClick={() => setPublishOpen(true)} className="rounded-md bg-[var(--accent)] px-2.5 py-1 text-[12px] font-medium text-white">
          Publish
        </button>
      </div>
    }>
      <div className="rounded-lg border border-[var(--border)] overflow-hidden mono text-[12px] leading-[1.7]">
        {lines.map((line, i) => (
          <div key={i} className={cn(
            "flex items-baseline gap-3 px-4 py-0.5",
            line.startsWith("+") && "bg-[var(--green-soft)] text-[var(--green)]",
            line.startsWith("-") && "bg-[var(--red-soft)] text-[var(--red)]",
            line.startsWith("@@") && "text-[var(--fg-muted)]",
          )}>
            <span className="w-6 text-right text-[10px] text-[var(--fg-faint)] select-none">{i + 1}</span>
            <span className="whitespace-pre">{line || " "}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
