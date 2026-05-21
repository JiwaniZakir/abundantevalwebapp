"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArchiveRestore, CheckCircle2, History, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Snapshot = {
  tag: string;
  createdAt: string;
  subject: string;
};

async function fetchSnapshots(): Promise<Snapshot[]> {
  const response = await fetch("/api/snapshots");
  if (!response.ok) return [];
  const data = (await response.json()) as { snapshots?: Snapshot[] };
  return data.snapshots ?? [];
}

function relative(date: string) {
  const ts = new Date(date).getTime();
  if (Number.isNaN(ts)) return date;
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function SnapshotMenu() {
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTag, setSavedTag] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void fetchSnapshots().then(setSnapshots);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const saveSnapshot = async () => {
    const trimmed = label.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: trimmed }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        log?: string;
        snapshots?: Snapshot[];
        error?: string;
        stderr?: string;
      };
      if (!response.ok || !data.ok) {
        setError(data.error ?? data.stderr ?? "Snapshot failed");
        return;
      }
      const tagMatch = data.log?.match(/Snapshot saved: (\S+)/);
      setSavedTag(tagMatch?.[1] ?? null);
      setSnapshots(data.snapshots ?? []);
      setLabel("");
      window.setTimeout(() => setSavedTag(null), 2400);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Snapshot failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline-strong)] bg-[var(--paper-pure)] px-3 py-1.5 text-[11.5px] text-[var(--ink-muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]",
          open && "bg-[var(--paper)] text-[var(--ink)]",
        )}
      >
        <History className="h-3.5 w-3.5" />
        Snapshots
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-[380px] overflow-hidden rounded-2xl border border-[var(--hairline-strong)] bg-[var(--paper-pure)] shadow-[var(--shadow-pop)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3">
              <p className="eyebrow">Snapshots</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="border-b border-[var(--hairline)] px-4 py-3">
              <div className="flex items-center gap-2 rounded-lg border border-[var(--hairline)] bg-[var(--paper)] px-3 py-2">
                <ArchiveRestore className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void saveSnapshot();
                    }
                  }}
                  placeholder="Label this checkpoint…"
                  className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-[var(--ink-faint)]"
                />
                <button
                  type="button"
                  onClick={() => void saveSnapshot()}
                  disabled={!label.trim() || saving}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded-full bg-[var(--ink)] px-3 text-[11px] font-medium text-[var(--paper-pure)] transition",
                    (!label.trim() || saving) && "opacity-40",
                  )}
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-[11px] text-[var(--status-red)]">{error}</p>
              )}
              {savedTag && (
                <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--status-green)]">
                  <CheckCircle2 className="h-3 w-3" /> Saved · <span className="mono">{savedTag}</span>
                </p>
              )}
            </div>

            <div className="max-h-[300px] overflow-y-auto px-2 py-2">
              {snapshots.length === 0 ? (
                <p className="px-3 py-4 text-[12px] text-[var(--ink-muted)]">
                  No snapshots yet. Label one above to mark a checkpoint.
                </p>
              ) : (
                snapshots.map((snapshot) => (
                  <div
                    key={snapshot.tag}
                    className="rounded-lg px-3 py-2 hover:bg-[var(--cream-soft)]"
                  >
                    <p className="mono text-[11px] text-[var(--ink)]">{snapshot.tag}</p>
                    <p className="mt-1 text-[12px] text-[var(--ink-soft)]">{snapshot.subject}</p>
                    <p className="mono mt-1 text-[10px] text-[var(--ink-faint)]">
                      {relative(snapshot.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
