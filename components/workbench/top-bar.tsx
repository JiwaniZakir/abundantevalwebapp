"use client";

import { ChevronDown, Command, Sparkles } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useWorkbench } from "@/lib/workbench/store";

function subscribeNoop() {
  return () => {};
}

function getIsMac() {
  if (typeof navigator === "undefined") return true;
  return navigator.platform.toUpperCase().includes("MAC");
}

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const workspace = useWorkbench((s) => s.workspace);
  const isStreaming = useWorkbench((s) => s.isStreaming);
  const isMac = useSyncExternalStore(subscribeNoop, getIsMac, () => true);

  return (
    <header className="flex h-12 items-center justify-between border-b border-[var(--hairline)] bg-[var(--paper)]/85 px-5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--paper-pure)]">
          <span className="serif text-[14px] font-semibold leading-none">H</span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-[13.5px] font-semibold tracking-[-0.01em]">
            Harbor Eval Studio
          </span>
          <span className="text-[var(--ink-faded)]">·</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[12px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            {workspace.projectName}
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {isStreaming && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--paper-pure)] px-2.5 py-1 text-[11px] text-[var(--ink)]">
            <Sparkles className="h-3 w-3" />
            orchestrator thinking
          </span>
        )}
        <button
          type="button"
          onClick={onOpenPalette}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--paper-pure)] px-3 py-1.5 text-[11.5px] text-[var(--ink-muted)] hover:bg-[var(--paper)]"
        >
          <Command className="h-3.5 w-3.5" />
          <span>Run command</span>
          <span className="kbd">{isMac ? "⌘" : "Ctrl"}</span>
          <span className="kbd">K</span>
        </button>
      </div>
    </header>
  );
}
