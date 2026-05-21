"use client";

import { AlertTriangle, CheckCircle2, X, XCircle } from "lucide-react";
import { useEffect } from "react";
import { useWorkbench } from "@/lib/workbench/store";
import { cn } from "@/lib/utils";

const tones = {
  info: { bg: "bg-white", border: "border-[var(--border-strong)]", accent: "text-[var(--blue)]", Icon: CheckCircle2 },
  warning: { bg: "bg-[var(--amber-soft)]", border: "border-[var(--amber-soft)]", accent: "text-[var(--amber)]", Icon: AlertTriangle },
  error: { bg: "bg-[var(--red-soft)]", border: "border-[var(--red-soft)]", accent: "text-[var(--red)]", Icon: XCircle },
} as const;

export function NoticeStack() {
  const notices = useWorkbench((s) => s.notices);
  const dismissNotice = useWorkbench((s) => s.dismissNotice);

  useEffect(() => {
    const timers = notices
      .filter((n) => n.level !== "error")
      .map((n) => window.setTimeout(() => dismissNotice(n.id), 6500));
    return () => { timers.forEach((t) => window.clearTimeout(t)); };
  }, [notices, dismissNotice]);

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-[340px] flex-col gap-2">
      {notices.map((notice) => {
        const t = tones[notice.level];
        return (
          <div
            key={notice.id}
            className={cn("pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg animate-fade-in", t.border, t.bg)}
          >
            <t.Icon className={cn("mt-0.5 h-4 w-4 shrink-0", t.accent)} />
            <p className="flex-1 text-[13px] leading-relaxed text-[var(--fg)]">{notice.message}</p>
            <button type="button" onClick={() => dismissNotice(notice.id)} className="text-[var(--fg-muted)] hover:text-[var(--fg)]">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
