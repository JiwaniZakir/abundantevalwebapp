"use client";

import { ArrowRight, FileText, RotateCcw, Search, X, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkbench } from "@/lib/workbench/store";
import { cn } from "@/lib/utils";

type PaletteItem = {
  id: string;
  label: string;
  category: "command" | "file" | "navigation" | "snapshot";
  description?: string;
};

const ACTIONS: PaletteItem[] = [
  { id: "/plan", label: "Draft a plan", category: "command", description: "Read workspace and create a pipeline roadmap" },
  { id: "/weakness", label: "Map weaknesses", category: "command", description: "Discover 5–10 weakness candidates from workflow" },
  { id: "/probe", label: "Run probes", category: "command", description: "5 variants, 15 trials each (batch when map approved)" },
  { id: "/scaffold", label: "Scaffold task", category: "command", description: "Generate instruction + task.toml" },
  { id: "/fixtures", label: "Generate fixtures", category: "command", description: "Synthesize multimodal inputs" },
  { id: "/sweep oracle", label: "Sweep oracle", category: "command", description: "Oracle sanity check" },
  { id: "/sweep nop", label: "Sweep nop", category: "command", description: "Nop tripwire check" },
  { id: "/sweep target", label: "Sweep target", category: "command", description: "Run target model trial" },
  { id: "/lint", label: "Lint spoilers", category: "command", description: "Check for spoiler leakage" },
  { id: "/audit", label: "Audit trajectory", category: "command", description: "Classify the failure mode" },
  { id: "/iterate", label: "Propose iteration", category: "command", description: "Suggest a diff to harden bait" },
  { id: "/publish", label: "Publish", category: "command", description: "Publish to Harbor registry (optional GitHub export)" },
];

const NAV_ACTIONS: PaletteItem[] = [
  { id: "nav:overview", label: "Go to Overview", category: "navigation" },
  { id: "nav:probe", label: "View Probe Results", category: "navigation" },
  { id: "nav:sweep", label: "View Sweep Results", category: "navigation" },
  { id: "nav:audit", label: "View Audit", category: "navigation" },
  { id: "nav:spoilers", label: "View Spoiler Lint", category: "navigation" },
  { id: "nav:iteration", label: "View Iteration Diff", category: "navigation" },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <PaletteContents onClose={onClose} />;
}

function PaletteContents({ onClose }: { onClose: () => void }) {
  const [{ query, activeIndex }, setQueryState] = useState({ query: "", activeIndex: 0 });
  const setQuery = useCallback((next: string) => setQueryState({ query: next, activeIndex: 0 }), []);
  const setActiveIndex = useCallback(
    (updater: (index: number) => number) => setQueryState((s) => ({ ...s, activeIndex: updater(s.activeIndex) })),
    [],
  );
  const sendInput = useWorkbench((s) => s.sendInput);
  const artifacts = useWorkbench((s) => s.workspace.artifacts);
  const openArtifact = useWorkbench((s) => s.openArtifact);
  const setFocus = useWorkbench((s) => s.setFocus);
  const resultsAvailable = useWorkbench((s) => s.resultsAvailable);
  const resetWorkspace = useWorkbench((s) => s.resetWorkspace);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const items = useMemo(() => {
    const lower = query.trim().toLowerCase();
    const fileItems: PaletteItem[] = Object.values(artifacts).map((a) => ({
      id: `file:${a.path}`,
      label: a.path,
      category: "file",
      description: a.badge ?? a.kind,
    }));

    const navItems = NAV_ACTIONS.filter((n) => {
      if (n.id === "nav:overview") return true;
      const key = n.id.replace("nav:", "") as keyof typeof resultsAvailable;
      return resultsAvailable[key];
    });

    const resetItem: PaletteItem = { id: "action:reset", label: "Reset workspace", category: "snapshot", description: "Clear all state and start fresh" };

    const all = [...ACTIONS, ...navItems, resetItem, ...fileItems];

    if (!lower) return all;
    return all.filter((item) => `${item.label} ${item.id} ${item.description ?? ""}`.toLowerCase().includes(lower));
  }, [artifacts, query, resultsAvailable]);

  const execute = useCallback((item: PaletteItem) => {
    if (item.category === "file") {
      openArtifact(item.label);
    } else if (item.category === "navigation") {
      const key = item.id.replace("nav:", "");
      if (key === "overview") setFocus({ kind: "none" });
      else setFocus({ kind: "result", result: key as "probe" | "sweep" | "audit" | "spoilers" | "iteration" });
    } else if (item.id === "action:reset") {
      resetWorkspace();
    } else {
      void sendInput(item.id);
    }
    onClose();
  }, [onClose, openArtifact, sendInput, setFocus, resetWorkspace]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(items.length - 1, i + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const item = items[activeIndex];
        if (item) execute(item);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeIndex, items, execute, setActiveIndex]);

  const grouped = useMemo(() => {
    const groups: Array<{ title: string; items: Array<PaletteItem & { globalIdx: number }> }> = [];
    const cats = ["command", "navigation", "snapshot", "file"] as const;
    const catLabels = { command: "Commands", navigation: "Navigate", snapshot: "Actions", file: "Files" };
    let idx = 0;
    for (const cat of cats) {
      const catItems = items.filter((i) => i.category === cat).map((i) => ({ ...i, globalIdx: idx++ }));
      if (catItems.length > 0) groups.push({ title: catLabels[cat], items: catItems });
    }
    return groups;
  }, [items]);

  const categoryIcon = (cat: string) => {
    if (cat === "command") return <Zap className="h-3 w-3" />;
    if (cat === "file") return <FileText className="h-3 w-3" />;
    if (cat === "snapshot") return <RotateCcw className="h-3 w-3" />;
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto mt-[14vh] w-[min(560px,92vw)] overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3.5">
          <Search className="h-4 w-4 text-[var(--fg-faint)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Run a command, jump to a file..."
            className="w-full bg-transparent text-[14px] text-[var(--fg)] outline-none placeholder:text-[var(--fg-faint)]"
          />
          <button type="button" onClick={onClose} className="text-[var(--fg-faint)] hover:text-[var(--fg-muted)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          {grouped.length === 0 && (
            <div className="p-8 text-center text-[13px] text-[var(--fg-faint)]">No matches.</div>
          )}
          {grouped.map((group) => (
            <div key={group.title} className="mb-1">
              <p className="px-3 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-faint)]">{group.title}</p>
              {group.items.map((item) => {
                const isActive = item.globalIdx === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => execute(item)}
                    onMouseEnter={() => setActiveIndex(() => item.globalIdx)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[13px]",
                      isActive ? "bg-[var(--accent)] text-white" : "text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className={cn(isActive ? "text-white/60" : "text-[var(--fg-faint)]")}>{categoryIcon(item.category)}</span>
                      <span className="truncate font-medium">{item.label}</span>
                      {item.description && <span className={cn("truncate text-[11px]", isActive ? "text-white/60" : "text-[var(--fg-faint)]")}>{item.description}</span>}
                    </span>
                    <ArrowRight className={cn("h-3 w-3 shrink-0 transition-opacity", isActive ? "opacity-100 text-white/60" : "opacity-0")} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2.5 text-[11px] text-[var(--fg-faint)]">
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px]">↑↓</kbd> navigate
            <kbd className="ml-2 rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px]">↵</kbd> run
          </span>
          <span><kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px]">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
