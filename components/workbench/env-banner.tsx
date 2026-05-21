"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { useWorkbench } from "@/lib/workbench/store";

export function EnvBanner() {
  const envStatus = useWorkbench((s) => s.envStatus);
  const mode = useWorkbench((s) => s.mode);
  const setMode = useWorkbench((s) => s.setMode);
  const [dismissed, setDismissed] = useState(false);

  if (!envStatus || dismissed) return null;
  const anyKey = envStatus.anthropic || envStatus.openai || envStatus.google;
  if (anyKey || mode !== "demo") return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="border-b border-[var(--hairline)] bg-[var(--cream-soft)] px-5 py-2.5"
      >
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 text-[12px]">
          <span className="inline-flex items-center gap-2 text-[var(--ink-soft)]">
            <AlertTriangle className="h-3.5 w-3.5 text-[var(--status-amber)]" />
            Demo mode is on because no LLM API key is configured. Add
            <span className="mono mx-1 rounded bg-[var(--paper-pure)] px-1.5">
              ANTHROPIC_API_KEY
            </span>
            ,
            <span className="mono mx-1 rounded bg-[var(--paper-pure)] px-1.5">
              GOOGLE_GENERATIVE_AI_API_KEY
            </span>
            , or
            <span className="mono mx-1 rounded bg-[var(--paper-pure)] px-1.5">
              OPENAI_API_KEY
            </span>
            to <span className="mono">.env.local</span>, then restart the dev server.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("demo")}
              className="rounded-full border border-[var(--hairline)] bg-[var(--paper-pure)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
            >
              Continue in demo
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-full p-1 text-[var(--ink-muted)] hover:bg-[var(--paper-pure)] hover:text-[var(--ink)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
