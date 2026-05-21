"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { CheckCircle2, ChevronRight, Folder, Layers } from "lucide-react";
import { useWorkbench } from "@/lib/workbench/store";
import { productStages, stageForPhase } from "@/lib/agent/stages";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const workspace = useWorkbench((s) => s.workspace);
  const setTaskPackOpen = useWorkbench((s) => s.setTaskPackOpen);
  const artifactCount = useMemo(
    () => Object.keys(workspace.artifacts).length,
    [workspace.artifacts],
  );
  const currentStage = stageForPhase(workspace.phase);
  const stageIndex = productStages.findIndex((stage) => stage.id === currentStage);

  return (
    <aside className="hidden h-full w-[240px] shrink-0 flex-col border-r border-[var(--hairline)] bg-[var(--cream)] lg:flex">
      <div className="px-5 pt-6 pb-5">
        <p className="eyebrow">Project</p>
        <div className="mt-2 flex items-start gap-2.5">
          <Layers className="mt-0.5 h-4 w-4 text-[var(--ink)]" />
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium leading-tight tracking-[-0.01em]">
              {workspace.projectName}
            </p>
            <p className="mono mt-1 truncate text-[10.5px] text-[var(--ink-faint)]">
              {workspace.runConfigHash}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        <p className="eyebrow mb-3">Journey</p>
        <ol className="relative space-y-1">
          <div className="absolute left-[9px] top-3 bottom-3 w-px bg-[var(--hairline)]" />
          {productStages.map((stage, index) => {
            const isActive = stage.id === currentStage;
            const isDone = stageIndex > index;
            return (
              <li
                key={stage.id}
                className={cn(
                  "relative flex items-start gap-3 rounded-lg px-2 py-2 transition-colors",
                  isActive
                    ? "bg-[var(--paper-pure)] shadow-[var(--shadow-soft)]"
                    : "hover:bg-[var(--cream-soft)]",
                )}
              >
                <span
                  className={cn(
                    "relative z-10 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-medium",
                    isDone
                      ? "bg-[var(--status-green-soft)] text-[var(--status-green)]"
                      : isActive
                        ? "bg-[var(--ink)] text-[var(--paper-pure)]"
                        : "bg-[var(--cream-deep)] text-[var(--ink-faint)]",
                  )}
                >
                  {isDone ? <CheckCircle2 className="h-3 w-3" /> : index + 1}
                </span>
                <div className="min-w-0 pt-px">
                  <p
                    className={cn(
                      "text-[12.5px] font-medium leading-tight",
                      isActive ? "text-[var(--ink)]" : "text-[var(--ink-muted)]",
                    )}
                  >
                    {stage.label}
                  </p>
                  {isActive && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.22 }}
                      className="mt-1 text-[11px] leading-[1.5] text-[var(--ink-muted)]"
                    >
                      {stage.description}
                    </motion.p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="border-t border-[var(--hairline)] px-5 py-4">
        <button
          type="button"
          onClick={() => setTaskPackOpen(true)}
          className="group flex w-full items-center justify-between rounded-xl border border-[var(--hairline)] bg-[var(--paper-pure)] px-3 py-2.5 text-left text-[12.5px] text-[var(--ink)] transition-colors hover:bg-[var(--cream-soft)]"
        >
          <span className="flex items-center gap-2.5">
            <Folder className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
            <span>Task pack</span>
            <span className="mono text-[10px] text-[var(--ink-faint)]">{artifactCount}</span>
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-[var(--ink-faint)] transition-transform group-hover:translate-x-0.5" />
        </button>
        <div className="mt-3 flex flex-col gap-1 text-[11px] text-[var(--ink-muted)]">
          <div className="flex items-center justify-between">
            <span>Target</span>
            <span className="mono text-[var(--ink)]">{workspace.targetModel.split("/").pop()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Auditor</span>
            <span className="mono text-[var(--ink)]">{workspace.auditorModel}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
