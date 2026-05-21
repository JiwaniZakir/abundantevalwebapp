"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { useWorkbench } from "@/lib/workbench/store";
import type { RuntimeMode } from "@/lib/workbench/store";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ id: RuntimeMode; label: string; hint: string }> = [
  { id: "live", label: "Live", hint: "Real LLM orchestrator + tools" },
  { id: "demo", label: "Demo", hint: "Scripted ds-25 walkthrough" },
];

export function ModeToggle() {
  const mode = useWorkbench((s) => s.mode);
  const setMode = useWorkbench((s) => s.setMode);
  const envStatus = useWorkbench((s) => s.envStatus);
  const setEnvStatus = useWorkbench((s) => s.setEnvStatus);

  useEffect(() => {
    if (envStatus) return;
    let cancelled = false;
    void fetch("/api/env/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setEnvStatus(data);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, [envStatus, setEnvStatus]);

  const liveAvailable =
    envStatus !== null &&
    (envStatus.anthropic || envStatus.openai || envStatus.google);

  return (
    <div className="relative inline-flex items-center rounded-full border border-[var(--hairline-strong)] bg-[var(--paper-pure)] p-0.5 text-[11.5px]">
      {OPTIONS.map((option) => {
        const isActive = option.id === mode;
        const isDisabled = option.id === "live" && envStatus !== null && !liveAvailable;
        return (
          <button
            key={option.id}
            type="button"
            disabled={isDisabled}
            title={isDisabled ? "Add an API key to .env.local to enable live mode" : option.hint}
            onClick={() => !isDisabled && setMode(option.id)}
            className={cn(
              "relative z-10 inline-flex h-6 items-center px-2.5 font-medium transition-colors",
              isActive ? "text-[var(--paper-pure)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
              isDisabled && "opacity-40",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="mode-pill"
                className="absolute inset-0 rounded-full bg-[var(--ink)]"
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
