"use client";

import { motion } from "motion/react";
import { ArrowRight, GitBranch, Sparkles } from "lucide-react";
import { useState } from "react";
import { useWorkbench } from "@/lib/workbench/store";
import {
  productStages,
  stageContexts,
  stageForPhase,
} from "@/lib/agent/stages";
import { cn } from "@/lib/utils";

function LiveIntakePanel() {
  const sendInput = useWorkbench((s) => s.sendInput);
  const [value, setValue] = useState("");
  const isStreaming = useWorkbench((s) => s.isStreaming);

  const submit = () => {
    const text = value.trim();
    if (!text || isStreaming) return;
    void sendInput(`Intake this workflow into a Harbor weakness card and get us through the pipeline:\n\n${text}`);
    setValue("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="mt-8 rounded-2xl border border-[var(--hairline-strong)] bg-[var(--paper-pure)] p-5 shadow-[var(--shadow-soft)]"
    >
      <p className="eyebrow">Workflow intake</p>
      <p className="mt-2 text-[13.5px] leading-6 text-[var(--ink-soft)]">
        Describe the operational workflow you want to turn into a Harbor eval. The
        orchestrator will derive a weakness card, probe the target model, and scaffold
        the task pack.
      </p>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={4}
        placeholder="e.g. Quarterly accounts-payable reconciliation across two ERPs where invoices live in finance.csv and approvals live in approvals.jsonl…"
        className="mt-4 block w-full resize-none rounded-xl border border-[var(--hairline)] bg-[var(--paper)] px-3 py-2.5 text-[13px] leading-6 text-[var(--ink)] outline-none focus:border-[var(--ink)]/30"
      />
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px] text-[var(--ink-muted)]">
          The agent will call <span className="mono">intake_workflow</span> then propose the weakness card.
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim() || isStreaming}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--paper-pure)] transition-transform hover:-translate-y-0.5",
            (!value.trim() || isStreaming) && "opacity-40 hover:translate-y-0",
          )}
        >
          <Sparkles className="h-3.5 w-3.5" /> Run intake
        </button>
      </div>
    </motion.div>
  );
}

export function Briefing() {
  const workspace = useWorkbench((s) => s.workspace);
  const sendInput = useWorkbench((s) => s.sendInput);
  const results = useWorkbench((s) => s.resultsAvailable);
  const setFocus = useWorkbench((s) => s.setFocus);
  const setPublishOpen = useWorkbench((s) => s.setPublishOpen);
  const mode = useWorkbench((s) => s.mode);
  const isStreaming = useWorkbench((s) => s.isStreaming);
  const stage = stageForPhase(workspace.phase);
  const context = stageContexts[stage];
  const stageIndex = productStages.findIndex((s) => s.id === stage);
  const hasWeakness = Object.keys(workspace.artifacts).some((path) =>
    path.startsWith("weakness/"),
  );
  const showIntake = mode === "live" && stage === "intake" && !hasWeakness;

  const completedJumps: Array<{ label: string; onClick: () => void }> = [];
  if (results.probe) {
    completedJumps.push({
      label: "Probe verdict",
      onClick: () => setFocus({ kind: "result", result: "probe" }),
    });
  }
  if (results.sweep) {
    completedJumps.push({
      label: "Sweep telemetry",
      onClick: () => setFocus({ kind: "result", result: "sweep" }),
    });
  }
  if (results.cascade) {
    completedJumps.push({
      label: "Cascade explainer",
      onClick: () => setFocus({ kind: "result", result: "cascade" }),
    });
  }
  if (results.audit) {
    completedJumps.push({
      label: "Audit verdict",
      onClick: () => setFocus({ kind: "result", result: "audit" }),
    });
  }
  if (results.iteration) {
    completedJumps.push({
      label: "Iteration diff",
      onClick: () => setFocus({ kind: "result", result: "iteration" }),
    });
  }
  if (results.spoilers) {
    completedJumps.push({
      label: "Spoiler findings",
      onClick: () => setFocus({ kind: "result", result: "spoilers" }),
    });
  }

  return (
    <section className="mx-auto flex h-full max-w-[760px] flex-col px-10 py-12">
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="eyebrow"
      >
        Stage {stageIndex + 1} of {productStages.length} · {stage}
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="display mt-3 text-[56px] font-semibold leading-[1.02] tracking-[-0.045em]"
      >
        {context.headline}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="mt-5 max-w-2xl text-[15px] leading-7 text-[var(--ink-muted)]"
      >
        {context.hint}
      </motion.p>

      {showIntake && <LiveIntakePanel />}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="mt-9 grid gap-2"
      >
        {stage === "publish" && (
          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            className="group flex items-center justify-between gap-4 rounded-2xl border border-[var(--ink)] bg-[var(--ink)] px-5 py-4 text-left text-[var(--paper-pure)] transition-transform hover:-translate-y-0.5"
          >
            <span className="flex items-center gap-3">
              <GitBranch className="h-4 w-4" />
              <span className="text-[14px] font-medium tracking-[-0.005em]">
                Publish task pack to GitHub
              </span>
            </span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        )}
        {context.chips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            disabled={isStreaming}
            onClick={() => void sendInput(chip.value)}
            className={cn(
              "group flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
              chip.tone === "primary"
                ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper-pure)] hover:bg-[var(--ink-soft)]"
                : "border-[var(--hairline-strong)] bg-[var(--paper-pure)] text-[var(--ink)] hover:bg-[var(--cream-soft)]",
            )}
          >
            <span className="flex items-center gap-3">
              <Sparkles
                className={cn(
                  "h-4 w-4",
                  chip.tone === "primary"
                    ? "text-[var(--paper-pure)]"
                    : "text-[var(--ink-muted)]",
                )}
              />
              <span className="text-[14px] font-medium tracking-[-0.005em]">
                {chip.label}
              </span>
            </span>
            <ArrowRight
              className={cn(
                "h-4 w-4 transition-transform group-hover:translate-x-1",
                chip.tone === "primary"
                  ? "text-[var(--paper-pure)]"
                  : "text-[var(--ink-faint)] group-hover:text-[var(--ink)]",
              )}
            />
          </button>
        ))}
      </motion.div>

      {completedJumps.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-10 border-t border-[var(--hairline)] pt-6"
        >
          <p className="eyebrow">Recent insights</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {completedJumps.map((jump) => (
              <button
                key={jump.label}
                type="button"
                onClick={jump.onClick}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--paper-pure)] px-3 py-1.5 text-[12px] text-[var(--ink-soft)] hover:bg-[var(--cream-soft)] hover:text-[var(--ink)]"
              >
                {jump.label}
                <ArrowRight className="h-3 w-3" />
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </section>
  );
}
