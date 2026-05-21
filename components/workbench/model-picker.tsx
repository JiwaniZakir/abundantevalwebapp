"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Cpu } from "lucide-react";
import { useWorkbench } from "@/lib/workbench/store";
import { modelRegistry } from "@/lib/ai/providers";
import { cn } from "@/lib/utils";

export function ModelPicker() {
  const workspace = useWorkbench((s) => s.workspace);
  const setTargetModel = useWorkbench((s) => s.setTargetModel);
  const envStatus = useWorkbench((s) => s.envStatus);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const activeShort = workspace.targetModel.split("/").pop() ?? workspace.targetModel;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline-strong)] bg-[var(--paper-pure)] px-3 py-1.5 text-[11.5px] text-[var(--ink-soft)] hover:bg-[var(--cream-soft)] hover:text-[var(--ink)]",
          open && "bg-[var(--paper)] text-[var(--ink)]",
        )}
        title="Switch target model"
      >
        <Cpu className="h-3.5 w-3.5" />
        <span className="mono">{activeShort}</span>
        <ChevronDown className="h-3 w-3 text-[var(--ink-muted)]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-[300px] overflow-hidden rounded-2xl border border-[var(--hairline-strong)] bg-[var(--paper-pure)] shadow-[var(--shadow-pop)]"
          >
            <p className="eyebrow border-b border-[var(--hairline)] px-4 py-3">
              Target model
            </p>
            <div className="p-2">
              {modelRegistry.map((model) => {
                const isActive = model.modelSlug === workspace.targetModel;
                const keyAvailable =
                  envStatus === null
                    ? true
                    : model.provider === "anthropic"
                      ? envStatus.anthropic
                      : model.provider === "openai"
                        ? envStatus.openai
                        : envStatus.google;
                return (
                  <button
                    key={model.modelSlug}
                    type="button"
                    onClick={() => {
                      setTargetModel(model.modelSlug, model.runner);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      isActive ? "bg-[var(--cream-soft)]" : "hover:bg-[var(--cream)]",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-medium text-[var(--ink)]">
                        {model.label}
                      </span>
                      <span className="mono mt-1 block truncate text-[10.5px] text-[var(--ink-faint)]">
                        {model.modelSlug}
                      </span>
                      <span className="mt-1 inline-flex items-center gap-2 text-[10.5px] text-[var(--ink-muted)]">
                        runner · {model.runner}
                        {!keyAvailable && (
                          <span className="rounded-full bg-[var(--status-amber-soft)] px-1.5 py-px text-[var(--status-amber)]">
                            no key
                          </span>
                        )}
                      </span>
                    </span>
                    {isActive && (
                      <Check className="mt-1 h-3.5 w-3.5 text-[var(--ink)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
