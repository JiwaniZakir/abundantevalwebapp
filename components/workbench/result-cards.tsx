"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Sparkles,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useWorkbench } from "@/lib/workbench/store";
import { ds25DependencyEdges } from "@/lib/domain/ds25-seed";
import { Badge } from "@/components/ui/badge";
import type { SpoilerFinding } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

function NextStepNudge({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: 0.4 }}
      className="group mt-6 flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--ink)] bg-[var(--ink)] px-5 py-4 text-left text-[var(--paper-pure)] transition-transform hover:-translate-y-0.5 hover:bg-[var(--ink-soft)]"
    >
      <span>
        <span className="flex items-center gap-2 text-[13.5px] font-medium tracking-[-0.005em]">
          <Sparkles className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className="mt-1 block text-[11.5px] text-[var(--paper-pure)]/70">
          {description}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
    </motion.button>
  );
}

function PanelChrome({
  eyebrow,
  title,
  trailing,
  children,
}: {
  eyebrow: string;
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto flex h-full max-w-[920px] flex-col px-10 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="display mt-2 text-[34px] font-semibold leading-[1.05] tracking-[-0.035em]">
            {title}
          </h2>
        </div>
        {trailing}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function ProbeResultCard() {
  const summary = useWorkbench((s) => s.probeSummary);
  const sendInput = useWorkbench((s) => s.sendInput);
  if (!summary) {
    return null;
  }

  const verdictTone: Record<typeof summary.verdict, "green" | "amber" | "red"> = {
    promote: "green",
    redesign: "amber",
    reject: "red",
  };

  const aggregate =
    summary.variants.reduce((acc, v) => acc + v.failureRate, 0) /
    Math.max(1, summary.variants.length);

  return (
    <PanelChrome
      eyebrow="Probe verdict"
      title={summary.weaknessTitle}
      trailing={<Badge variant={verdictTone[summary.verdict]}>{summary.verdict}</Badge>}
    >
      <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--paper-pure)] p-7 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Aggregate failure rate</p>
            <div className="display mt-2 text-[64px] font-semibold leading-none tracking-[-0.05em]">
              {Math.round(aggregate * 100)}
              <span className="text-[28px] text-[var(--ink-muted)]">%</span>
            </div>
            <p className="mt-3 text-[12.5px] text-[var(--ink-muted)]">
              {summary.variants.length} pressure variants · {summary.variants[0]?.trials ?? 0} trials each
            </p>
          </div>
          <div className="rounded-xl bg-[var(--cream-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--ink-soft)]">
            {summary.verdict === "promote" &&
              "Failure clears the 80% promote threshold. The bait is doing real work — ready to scaffold."}
            {summary.verdict === "redesign" &&
              "Mid-range failure. Tighten bait realism or pressure framing before committing to a scaffold."}
            {summary.verdict === "reject" &&
              "The target solved it. Find a harder framing before spending on Harbor."}
          </div>
        </div>

        <div className="mt-7 space-y-2.5" data-testid="probe-variants">
          {summary.variants.map((variant, index) => (
            <motion.div
              key={variant.variant}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + index * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-[140px_1fr_72px_64px] items-center gap-4 rounded-xl border border-[var(--hairline)] bg-[var(--cream)]/70 px-4 py-3"
            >
              <span className="mono text-[11px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">
                {variant.variant.replace("_", " ")}
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--cream-deep)]">
                <motion.div
                  className="h-full rounded-full bg-[var(--ink)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${variant.failureRate * 100}%` }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <span className="mono text-right text-[12.5px] text-[var(--ink)]">
                {Math.round(variant.failureRate * 100)}%
              </span>
              <span className="mono text-right text-[11px] text-[var(--ink-faint)]">
                {variant.failures}/{variant.trials}
              </span>
            </motion.div>
          ))}
        </div>

        {summary.verdict === "promote" && (
          <NextStepNudge
            label="Scaffold the Harbor task pack"
            description="Translate the verdict into instruction.md, task.toml, and the verifier outline."
            onClick={() => void sendInput("/scaffold")}
          />
        )}
        {summary.verdict === "redesign" && (
          <NextStepNudge
            label="Tighten the bait"
            description="Propose an iteration to the bait artifact and rerun the probe."
            onClick={() => void sendInput("/iterate")}
          />
        )}
        {summary.verdict === "reject" && (
          <NextStepNudge
            label="Map a different weakness"
            description="Pick another failure-mode hypothesis before spending on scaffold."
            onClick={() => void sendInput("/weakness")}
          />
        )}
      </div>
    </PanelChrome>
  );
}

export function SweepResultCard() {
  const summary = useWorkbench((s) => s.sweepSummary);
  const setFocus = useWorkbench((s) => s.setFocus);
  const sendInput = useWorkbench((s) => s.sendInput);
  const cascadeAvailable = useWorkbench((s) => s.resultsAvailable.cascade);

  if (!summary) return null;

  const passes = summary.trials.filter((t) => t.status === "passed").length;
  const tone = passes === 0 ? "red" : passes < summary.trials.length ? "amber" : "green";

  return (
    <PanelChrome
      eyebrow="Harbor sweep"
      title={summary.taskSlug}
      trailing={
        <div className="flex items-center gap-2">
          <Badge variant={tone}>pass@3 · {summary.passAt3}</Badge>
          {cascadeAvailable && (
            <button
              type="button"
              onClick={() => setFocus({ kind: "result", result: "cascade" })}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline-strong)] bg-[var(--paper-pure)] px-3 py-1.5 text-[11.5px] text-[var(--ink-soft)] transition-colors hover:bg-[var(--cream-soft)] hover:text-[var(--ink)]"
            >
              <GitBranch className="h-3 w-3" /> view cascade
            </button>
          )}
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-3">
        {summary.trials.map((trial, index) => {
          const Icon =
            trial.status === "passed"
              ? CheckCircle2
              : trial.status === "failed"
                ? XCircle
                : AlertTriangle;
          const iconTone =
            trial.status === "passed"
              ? "text-[var(--status-green)]"
              : trial.status === "failed"
                ? "text-[var(--status-red)]"
                : "text-[var(--status-amber)]";
          return (
            <motion.div
              key={trial.idx}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1 + index * 0.18, type: "spring", stiffness: 220, damping: 24 }}
              className="rounded-2xl border border-[var(--hairline)] bg-[var(--paper-pure)] p-5 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-center justify-between">
                <span className="eyebrow">Trial {trial.idx}</span>
                <Icon className={cn("h-4 w-4", iconTone)} />
              </div>
              <div className="display mt-3 text-[40px] font-semibold tracking-[-0.04em]">
                {trial.reward.toFixed(1)}
              </div>
              <p className="mt-2.5 text-[12.5px] leading-[1.6] text-[var(--ink-muted)]">
                {trial.summary}
              </p>
            </motion.div>
          );
        })}
      </div>

      {passes === 0 && cascadeAvailable && (
        <NextStepNudge
          label="See why the task is hard"
          description="Open the dependency cascade to inspect how revocation propagates."
          onClick={() => setFocus({ kind: "result", result: "cascade" })}
        />
      )}
      {passes === 0 && !cascadeAvailable && (
        <NextStepNudge
          label="Audit the trajectory"
          description="Classify the failure with the non-target auditor."
          onClick={() => void sendInput("/audit")}
        />
      )}
    </PanelChrome>
  );
}

const cascadeTone: Record<string, string> = {
  revoked:
    "border-[var(--status-red-soft)] bg-[var(--status-red-soft)] text-[var(--status-red)]",
  blocked:
    "border-[var(--status-amber-soft)] bg-[var(--status-amber-soft)] text-[var(--status-amber)]",
  conflict:
    "border-[var(--status-amber-soft)] bg-[var(--status-amber-soft)] text-[var(--status-amber)]",
  manual_review:
    "border-[var(--status-blue-soft)] bg-[var(--status-blue-soft)] text-[var(--status-blue)]",
  active:
    "border-[var(--status-green-soft)] bg-[var(--status-green-soft)] text-[var(--status-green)]",
};

export function CascadeInsightCard() {
  const summary = useWorkbench((s) => s.sweepSummary);
  const sendInput = useWorkbench((s) => s.sendInput);
  if (!summary?.cascade) return null;
  const nodes = summary.cascade;

  return (
    <PanelChrome
      eyebrow="Why the task is hard"
      title="Revocation cascades through the dependency graph"
      trailing={<Badge variant="ink">aha moment</Badge>}
    >
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          {nodes.map((node, index) => (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + index * 0.07 }}
              className={cn(
                "rounded-2xl border bg-[var(--paper-pure)] p-5 shadow-[var(--shadow-soft)]",
                cascadeTone[node.status] ?? "border-[var(--hairline)]",
              )}
            >
              <p className="mono text-[10.5px] uppercase tracking-[0.12em]">{node.id}</p>
              <p className="mt-2 text-[14px] font-medium text-[var(--ink)]">{node.label}</p>
              <p className="mono mt-3 text-[10.5px] uppercase tracking-[0.12em]">
                {node.status.replace("_", " ")}
              </p>
            </motion.div>
          ))}
        </div>

        <div>
          <p className="eyebrow mb-3">Trace</p>
          <div className="flex flex-wrap gap-2">
            {ds25DependencyEdges.map(([from, to], index) => (
              <motion.span
                key={`${from}-${to}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.04 }}
                className="mono inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--paper-pure)] px-3 py-1 text-[11px] text-[var(--ink-muted)]"
              >
                {from} <ArrowRight className="h-3 w-3" /> {to}
              </motion.span>
            ))}
          </div>
        </div>

        <NextStepNudge
          label="Audit the failure officially"
          description="Run the trajectory audit to confirm this is a genuine model weakness."
          onClick={() => void sendInput("/audit")}
        />
      </div>
    </PanelChrome>
  );
}

export function AuditCard() {
  const audit = useWorkbench((s) => s.audit);
  const sendInput = useWorkbench((s) => s.sendInput);
  if (!audit) return null;

  return (
    <PanelChrome
      eyebrow="Trajectory audit"
      title={audit.classification.replace(/_/g, " ")}
      trailing={
        <Badge variant="ink">
          <Sparkles className="h-3 w-3" /> auditor verified
        </Badge>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="rounded-2xl border border-[var(--hairline)] bg-[var(--paper-pure)] p-7 shadow-[var(--shadow-soft)]"
      >
        <p className="text-[15px] leading-7 text-[var(--ink-soft)]">{audit.rationale}</p>
        <p className="mono mt-6 text-[10.5px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">
          auditor · {audit.auditorModel}
        </p>
      </motion.div>

      <NextStepNudge
        label="Propose an iteration"
        description="Tighten the bait artifact so the failure mode stays hard after publishing."
        onClick={() => void sendInput("/iterate")}
      />
    </PanelChrome>
  );
}

const severityTone: Record<SpoilerFinding["severity"], "red" | "amber" | "blue"> = {
  high: "red",
  medium: "amber",
  low: "blue",
};

export function SpoilerFindingsCard() {
  const findings = useWorkbench((s) => s.spoilerFindings);
  const openArtifact = useWorkbench((s) => s.openArtifact);

  if (findings.length === 0) {
    return (
      <PanelChrome
        eyebrow="Spoiler lint"
        title="No findings"
        trailing={<Badge variant="green">clean</Badge>}
      >
        <p className="text-[13.5px] leading-7 text-[var(--ink-muted)]">
          The most recent lint pass surfaced no recipe sentences, trap names, expected-answer paths,
          or self-incriminating bait. Re-run /lint after future edits.
        </p>
      </PanelChrome>
    );
  }

  const high = findings.filter((f) => f.severity === "high").length;
  const tone = high > 0 ? "red" : "amber";

  return (
    <PanelChrome
      eyebrow="Spoiler lint"
      title={`${findings.length} finding${findings.length === 1 ? "" : "s"}`}
      trailing={<Badge variant={tone}>{high > 0 ? `${high} high severity` : "review"}</Badge>}
    >
      <div className="space-y-2">
        {findings.map((finding, index) => (
          <motion.button
            key={`${finding.artifactPath}-${finding.line}-${index}`}
            type="button"
            onClick={() => openArtifact(finding.artifactPath)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 + index * 0.04 }}
            className="group flex w-full items-start justify-between gap-4 rounded-xl border border-[var(--hairline)] bg-[var(--paper-pure)] p-4 text-left shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[11px] text-[var(--ink-muted)]">
                <Badge variant={severityTone[finding.severity]}>{finding.severity}</Badge>
                <span className="mono truncate">{finding.artifactPath}:L{finding.line}</span>
                <span className="mono text-[var(--ink-faint)]">{finding.ruleId}</span>
              </span>
              <span className="mt-2 block text-[13px] leading-6 text-[var(--ink)]">
                {finding.message}
              </span>
            </span>
            <ArrowRight className="mt-1 h-3.5 w-3.5 text-[var(--ink-faded)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--ink)]" />
          </motion.button>
        ))}
      </div>
    </PanelChrome>
  );
}

type AppliedDiff = {
  targetPath: string | null;
  before: string | null;
  after: string | null;
  rationale: string | null;
};

function parseIterationDiff(content: string): AppliedDiff {
  const targetMatch = content.match(/^\+\+\+\s+b\/(.+)$/m);
  const beforeLines: string[] = [];
  const afterLines: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith("--- ") || line.startsWith("+++ ") || line.startsWith("@@")) continue;
    if (line.startsWith("- ")) beforeLines.push(line.slice(2));
    else if (line.startsWith("+ ")) afterLines.push(line.slice(2));
  }
  const rationaleMatch = content.match(/Rationale:\s*([\s\S]+?)(?:\n\n|$)/);
  return {
    targetPath: targetMatch ? targetMatch[1].trim() : null,
    before: beforeLines.join("\n") || null,
    after: afterLines.join("\n") || null,
    rationale: rationaleMatch ? rationaleMatch[1].trim() : null,
  };
}

export function IterationDiffCard() {
  const workspace = useWorkbench((s) => s.workspace);
  const latestPath = useWorkbench((s) => s.latestIterationPath);
  const setPublishOpen = useWorkbench((s) => s.setPublishOpen);
  const applyIteration = useWorkbench((s) => s.applyIteration);
  const openArtifact = useWorkbench((s) => s.openArtifact);
  const artifact = latestPath ? workspace.artifacts[latestPath] : undefined;
  if (!artifact) {
    return null;
  }

  const parsed = parseIterationDiff(artifact.content);
  const targetArtifact = parsed.targetPath
    ? workspace.artifacts[parsed.targetPath]
    : null;
  const canApply = Boolean(parsed.targetPath && parsed.before && parsed.after);
  const conflict =
    canApply && targetArtifact
      ? !targetArtifact.content.includes(parsed.before ?? "__never__")
      : false;

  const lines = artifact.content.split("\n");

  return (
    <PanelChrome
      eyebrow="Iteration proposal"
      title={latestPath ?? "iteration"}
      trailing={
        <div className="flex items-center gap-2">
          {canApply && (
            <button
              type="button"
              onClick={() => {
                if (!parsed.targetPath || parsed.before === null || parsed.after === null) return;
                const result = applyIteration({
                  diffPath: latestPath!,
                  targetPath: parsed.targetPath,
                  before: parsed.before,
                  after: parsed.after,
                });
                if (result.ok) {
                  openArtifact(parsed.targetPath);
                }
              }}
              disabled={conflict}
              title={conflict ? "Target content drifted; manual review required" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline-strong)] bg-[var(--paper-pure)] px-3 py-1.5 text-[11.5px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--cream-soft)]",
                conflict && "cursor-not-allowed opacity-40",
              )}
            >
              <CheckCircle2 className="h-3 w-3" /> Apply iteration
            </button>
          )}
          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 py-1.5 text-[11.5px] font-medium text-[var(--paper-pure)] transition-colors hover:bg-[var(--ink-soft)]"
          >
            <CheckCircle2 className="h-3 w-3" /> Accept and publish
          </button>
        </div>
      }
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--paper-pure)] shadow-[var(--shadow-soft)]">
        <div className="mono divide-y divide-[var(--hairline)] text-[12.5px] leading-[1.7]">
          {lines.map((line, index) => {
            const tone = line.startsWith("+")
              ? "bg-[var(--status-green-soft)] text-[var(--status-green)]"
              : line.startsWith("-")
                ? "bg-[var(--status-red-soft)] text-[var(--status-red)]"
                : line.startsWith("@@")
                  ? "text-[var(--ink-muted)]"
                  : "text-[var(--ink-soft)]";
            return (
              <div key={index} className={cn("flex items-baseline gap-3 px-5 py-1.5", tone)}>
                <span className="mono w-8 shrink-0 text-right text-[10px] text-[var(--ink-faint)]">
                  {index + 1}
                </span>
                <span className="whitespace-pre">{line || " "}</span>
              </div>
            );
          })}
        </div>
      </div>
    </PanelChrome>
  );
}
