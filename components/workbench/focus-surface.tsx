"use client";

import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  Compass,
  FileText,
  FlaskConical,
  GitBranch,
  Layers,
  Sparkles,
  X,
} from "lucide-react";
import { useWorkbench } from "@/lib/workbench/store";
import type { ResultSurface } from "@/lib/workbench/store";
import { CodeView } from "./code-view";
import { Briefing } from "./briefing";
import {
  AuditCard,
  CascadeInsightCard,
  IterationDiffCard,
  ProbeResultCard,
  SpoilerFindingsCard,
  SweepResultCard,
} from "./result-cards";

type BreadcrumbItem = {
  icon: React.ReactNode;
  label: string;
};

function breadcrumbForFocus(focus: ReturnType<typeof useWorkbench.getState>["focus"]): BreadcrumbItem {
  if (focus.kind === "briefing") {
    return { icon: <Compass className="h-3.5 w-3.5" />, label: "Briefing" };
  }
  if (focus.kind === "artifact") {
    return { icon: <FileText className="h-3.5 w-3.5" />, label: focus.path };
  }
  const labels: Record<ResultSurface, string> = {
    probe: "Probe verdict",
    sweep: "Harbor sweep",
    cascade: "Dependency cascade",
    audit: "Trajectory audit",
    iteration: "Iteration diff",
    spoilers: "Spoiler lint",
  };
  const icons: Record<ResultSurface, React.ReactNode> = {
    probe: <FlaskConical className="h-3.5 w-3.5" />,
    sweep: <Activity className="h-3.5 w-3.5" />,
    cascade: <GitBranch className="h-3.5 w-3.5" />,
    audit: <Sparkles className="h-3.5 w-3.5" />,
    iteration: <AlertTriangle className="h-3.5 w-3.5" />,
    spoilers: <AlertTriangle className="h-3.5 w-3.5" />,
  };
  return { icon: icons[focus.result], label: labels[focus.result] };
}

export function FocusSurface() {
  const focus = useWorkbench((s) => s.focus);
  const setFocus = useWorkbench((s) => s.setFocus);
  const setTaskPackOpen = useWorkbench((s) => s.setTaskPackOpen);
  const workspace = useWorkbench((s) => s.workspace);
  const spoilerFindings = useWorkbench((s) => s.spoilerFindings);

  const breadcrumb = breadcrumbForFocus(focus);
  const isBriefing = focus.kind === "briefing";
  const focusKey =
    focus.kind === "briefing"
      ? "briefing"
      : focus.kind === "artifact"
        ? `artifact:${focus.path}`
        : `result:${focus.result}`;

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-[var(--cream)]">
      <div className="flex h-12 items-center justify-between border-b border-[var(--hairline)] bg-[var(--paper)]/85 px-5 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
          {!isBriefing && (
            <button
              type="button"
              onClick={() => setFocus({ kind: "briefing" })}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--paper-pure)] px-2.5 py-1 text-[11px] hover:bg-[var(--cream-soft)] hover:text-[var(--ink)]"
            >
              <ChevronLeft className="h-3 w-3" />
              Briefing
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 text-[var(--ink-muted)]">
            {breadcrumb.icon}
            <span className="mono text-[11px]">{breadcrumb.label}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {focus.kind === "artifact" && (
            <button
              type="button"
              onClick={() => setFocus({ kind: "briefing" })}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--ink-faded)] hover:bg-[var(--cream-soft)] hover:text-[var(--ink)]"
              aria-label="Close artifact"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setTaskPackOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--paper-pure)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)] hover:bg-[var(--cream-soft)] hover:text-[var(--ink)]"
          >
            <Layers className="h-3 w-3" /> Task pack
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={focusKey}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 overflow-y-auto"
          >
            {focus.kind === "briefing" && <Briefing />}
            {focus.kind === "artifact" && workspace.artifacts[focus.path] && (
              <CodeView
                content={workspace.artifacts[focus.path].content}
                kind={workspace.artifacts[focus.path].kind}
                findings={spoilerFindings.filter(
                  (finding) =>
                    focus.kind === "artifact" && finding.artifactPath === focus.path,
                )}
              />
            )}
            {focus.kind === "result" && focus.result === "probe" && <ProbeResultCard />}
            {focus.kind === "result" && focus.result === "sweep" && <SweepResultCard />}
            {focus.kind === "result" && focus.result === "cascade" && (
              <CascadeInsightCard />
            )}
            {focus.kind === "result" && focus.result === "audit" && <AuditCard />}
            {focus.kind === "result" && focus.result === "iteration" && (
              <IterationDiffCard />
            )}
            {focus.kind === "result" && focus.result === "spoilers" && (
              <SpoilerFindingsCard />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
