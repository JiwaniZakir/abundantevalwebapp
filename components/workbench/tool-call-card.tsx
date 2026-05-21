"use client";

import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  Wrench,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { ToolCall } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

const labels: Record<ToolCall["name"], string> = {
  list_workspace: "List workspace",
  read_artifact: "Read artifact",
  write_artifact: "Write artifact",
  propose_weakness_card: "Promote weakness card",
  intake_workflow: "Intake workflow",
  run_probe_variants: "Run probe variants",
  lint_spoilers: "Lint spoilers",
  generate_fixtures: "Generate fixtures",
  scaffold_task: "Scaffold Harbor task pack",
  run_harbor_sweep: "Run Harbor sweep",
  audit_trajectory: "Audit trajectory",
  propose_iteration: "Propose iteration",
  set_phase: "Set phase",
};

export function ToolCallCard({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const argEntries = Object.entries(call.args);
  const isRunning = call.status === "running";
  const isFailed = call.status === "failed";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className={cn(
        "overflow-hidden rounded-xl border bg-[var(--paper-pure)] shadow-[var(--shadow-soft)]",
        isRunning
          ? "border-[var(--hairline)] ring-1 ring-[var(--ink)]/10"
          : isFailed
            ? "border-[var(--status-red-soft)] ring-1 ring-[var(--status-red)]/20"
            : "border-[var(--hairline)]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
      >
        <span className="flex items-center gap-2.5 text-[12.5px]">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-lg",
              isRunning
                ? "bg-[var(--cream-soft)] text-[var(--ink)]"
                : isFailed
                  ? "bg-[var(--status-red-soft)] text-[var(--status-red)]"
                  : "bg-[var(--cream)] text-[var(--ink-muted)]",
            )}
          >
            {isRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isFailed ? (
              <XCircle className="h-3.5 w-3.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
          </span>
          <span className="mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">
            {isFailed ? "failed" : "tool"}
          </span>
          <span className="font-medium text-[var(--ink)]">{labels[call.name] ?? call.name}</span>
        </span>
        <span className="flex items-center gap-2 text-[11.5px] text-[var(--ink-muted)]">
          {call.summary && !open && (
            <span className="hidden max-w-[14rem] truncate sm:inline">{call.summary}</span>
          )}
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-[var(--hairline)]"
          >
            <div className="p-3.5 text-[12px]">
              <div className="flex items-center gap-2 text-[var(--ink-muted)]">
                <Wrench className="h-3.5 w-3.5" />
                <span className="mono">{call.name}</span>
              </div>
              {argEntries.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {argEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-baseline gap-3 rounded-md bg-[var(--cream)] px-2.5 py-1.5 text-[11.5px]"
                    >
                      <span className="mono shrink-0 text-[var(--ink-faint)]">{key}</span>
                      <span className="mono flex-1 truncate text-[var(--ink-soft)]">
                        {typeof value === "string"
                          ? value
                          : JSON.stringify(value).slice(0, 260)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {call.summary && (
                <p className="mt-3 text-[12px] leading-6 text-[var(--ink-muted)]">
                  {call.summary}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
