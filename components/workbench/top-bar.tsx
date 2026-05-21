"use client";

import { Command, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useWorkbench } from "@/lib/workbench/store";
import { LiveEnvStatus } from "./live-env-status";
import { ModelPicker } from "./model-picker";
import { stageForPhase, productStages } from "@/lib/agent/stages";
import { cn } from "@/lib/utils";

function getIsMac() {
  if (typeof navigator === "undefined") return true;
  return navigator.platform.toUpperCase().includes("MAC");
}

export function TopBar({
  onOpenPalette,
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
}: {
  onOpenPalette: () => void;
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
}) {
  const workspace = useWorkbench((s) => s.workspace);
  const isStreaming = useWorkbench((s) => s.isStreaming);
  const isMac = useSyncExternalStore(() => () => {}, getIsMac, () => true);
  const stage = stageForPhase(workspace.phase);
  const stageMeta = productStages.find((s) => s.id === stage);

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--border)] px-4 bg-[var(--bg)]">
      <div className="flex items-center gap-3 min-w-0">
        <button type="button" onClick={onToggleLeft} aria-label="Toggle files" className="rounded-md p-1.5 text-[var(--fg-muted)] hover:text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
          {leftOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>

        <div className="min-w-0">
          <p className="text-title truncate">{workspace.projectName}</p>
          <p className="text-micro text-[var(--fg-muted)] truncate">{stageMeta?.label ?? "Intake"}</p>
        </div>

        {isStreaming && (
          <span className="hidden sm:flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-micro font-medium text-[var(--accent)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            Running
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ModelPicker />
        <LiveEnvStatus />

        <button type="button" onClick={onToggleRight} aria-label="Toggle studio" className="rounded-md p-1.5 text-[var(--fg-muted)] hover:text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
          {rightOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </button>

        <button type="button" onClick={onOpenPalette} className={cn("flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-micro text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] transition-colors")}>
          <Command className="h-3.5 w-3.5" />
          <span className="mono">{isMac ? "⌘K" : "^K"}</span>
        </button>
      </div>
    </header>
  );
}
