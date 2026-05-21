"use client";

import { ArrowRight, FileText, Search, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useWorkbench } from "@/lib/workbench/store";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { id: "/plan", label: "Draft a plan for ds-25", category: "agent" },
  { id: "/weakness", label: "Promote a lifecycle weakness card", category: "agent" },
  { id: "/probe", label: "Run 5 probe variants (15 trials each)", category: "agent" },
  { id: "/scaffold", label: "Stage instruction + task.toml", category: "agent" },
  { id: "/fixtures", label: "Generate multimodal fixtures", category: "agent" },
  { id: "/sweep oracle", label: "Run oracle sanity sweep", category: "agent" },
  { id: "/sweep nop", label: "Run nop tripwire sweep", category: "agent" },
  { id: "/sweep target", label: "Run target model sweep", category: "agent" },
  { id: "/lint", label: "Spoiler-lint the current artifact", category: "agent" },
  { id: "/audit", label: "Audit the latest trajectory", category: "agent" },
  { id: "/iterate", label: "Propose an iteration diff", category: "agent" },
  { id: "/publish", label: "Finalize task version", category: "agent" },
] as const;

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && <PaletteContents onClose={onClose} />}
    </AnimatePresence>
  );
}

function PaletteContents({ onClose }: { onClose: () => void }) {
  const [{ query, activeIndex }, setQueryState] = useState({
    query: "",
    activeIndex: 0,
  });
  const setQuery = useCallback(
    (next: string) => setQueryState({ query: next, activeIndex: 0 }),
    [],
  );
  const setActiveIndex = useCallback(
    (updater: (index: number) => number) =>
      setQueryState((state) => ({ ...state, activeIndex: updater(state.activeIndex) })),
    [],
  );
  const sendInput = useWorkbench((s) => s.sendInput);
  const artifacts = useWorkbench((s) => s.workspace.artifacts);
  const openArtifact = useWorkbench((s) => s.openArtifact);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const items = useMemo(() => {
    const lower = query.trim().toLowerCase();
    const fileItems = Object.values(artifacts).map((artifact) => ({
      id: `file:${artifact.path}`,
      label: artifact.path,
      category: "file" as const,
    }));
    const actionItems = ACTIONS.map((action) => ({ ...action }));

    const all = [...actionItems, ...fileItems];

    if (!lower) return all;
    return all.filter((item) =>
      `${item.label} ${item.id}`.toLowerCase().includes(lower),
    );
  }, [artifacts, query]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(items.length - 1, index + 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(0, index - 1));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const item = items[activeIndex];
        if (!item) return;
        if (item.category === "file") {
          openArtifact(item.label);
        } else {
          void sendInput(item.id);
        }
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeIndex, items, onClose, openArtifact, sendInput, setActiveIndex]);

  return (
    <motion.div
      key="palette-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 bg-[rgba(20,20,20,0.32)] backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        key="palette"
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        className="mx-auto mt-[14vh] w-[min(640px,92vw)] overflow-hidden rounded-2xl border border-[var(--hairline-strong)] bg-[var(--paper-pure)] shadow-[var(--shadow-pop)]"
        onClick={(event) => event.stopPropagation()}
      >
            <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-4 py-3.5">
              <Search className="h-4 w-4 text-[var(--ink-muted)]" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Run a command, jump to a file, or describe a workflow"
                className="w-full bg-transparent text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
              />
              <button
                type="button"
                onClick={onClose}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {items.length === 0 && (
                <div className="p-6 text-center text-[12.5px] text-[var(--ink-muted)]">
                  No matches. Hit <span className="kbd">esc</span> to close.
                </div>
              )}
              {items.map((item, index) => {
                const isActive = index === activeIndex;
                const isFile = item.category === "file";
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (isFile) {
                        openArtifact(item.label);
                      } else {
                        void sendInput(item.id);
                      }
                      onClose();
                    }}
                    onMouseEnter={() => setActiveIndex(() => index)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[12.5px]",
                      isActive
                        ? "bg-[var(--cream-soft)] text-[var(--ink)]"
                        : "text-[var(--ink-soft)] hover:bg-[var(--cream)]",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      {isFile ? (
                        <FileText className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
                      )}
                      {!isFile && (
                        <span className="mono text-[var(--ink-faint)]">{item.id}</span>
                      )}
                      <span className="truncate">{item.label}</span>
                    </span>
                    <ArrowRight
                      className={cn(
                        "h-3 w-3 transition-opacity",
                        isActive ? "opacity-100 text-[var(--ink)]" : "opacity-0",
                      )}
                    />
                  </button>
                );
              })}
            </div>

        <div className="flex items-center justify-between border-t border-[var(--hairline)] px-4 py-2.5 text-[11px] text-[var(--ink-muted)]">
          <span className="flex items-center gap-2">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> navigate
            <span className="ml-3 kbd">↵</span> run
          </span>
          <span className="flex items-center gap-1">
            <span className="kbd">esc</span> close
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
