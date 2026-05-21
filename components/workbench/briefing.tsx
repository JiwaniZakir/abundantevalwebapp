"use client";

import { motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useWorkbench } from "@/lib/workbench/store";
import {
  productStages,
  stageContexts,
  stageForPhase,
} from "@/lib/agent/stages";
import { cn } from "@/lib/utils";

export function Briefing() {
  const workspace = useWorkbench((s) => s.workspace);
  const sendInput = useWorkbench((s) => s.sendInput);
  const results = useWorkbench((s) => s.resultsAvailable);
  const setFocus = useWorkbench((s) => s.setFocus);
  const stage = stageForPhase(workspace.phase);
  const context = stageContexts[stage];
  const stageIndex = productStages.findIndex((s) => s.id === stage);

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

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="mt-9 grid gap-2"
      >
        {context.chips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => void sendInput(chip.value)}
            className={cn(
              "group flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left transition-all hover:-translate-y-0.5",
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
