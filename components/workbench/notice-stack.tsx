"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { useWorkbench } from "@/lib/workbench/store";

const tone = {
  info: {
    bg: "bg-[var(--paper-pure)]",
    border: "border-[var(--hairline-strong)]",
    accent: "text-[var(--status-blue)]",
    icon: Info,
  },
  warning: {
    bg: "bg-[var(--status-amber-soft)]",
    border: "border-[var(--status-amber-soft)]",
    accent: "text-[var(--status-amber)]",
    icon: AlertTriangle,
  },
  error: {
    bg: "bg-[var(--status-red-soft)]",
    border: "border-[var(--status-red-soft)]",
    accent: "text-[var(--status-red)]",
    icon: XCircle,
  },
} as const;

export function NoticeStack() {
  const notices = useWorkbench((s) => s.notices);
  const dismissNotice = useWorkbench((s) => s.dismissNotice);

  useEffect(() => {
    const timers = notices
      .filter((notice) => notice.level !== "error")
      .map((notice) =>
        window.setTimeout(() => dismissNotice(notice.id), 6500),
      );
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [notices, dismissNotice]);

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-[360px] flex-col gap-2">
      <AnimatePresence>
        {notices.map((notice) => {
          const variant = tone[notice.level];
          const Icon = notice.level === "info" ? CheckCircle2 : variant.icon;
          return (
            <motion.div
              key={notice.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${variant.border} ${variant.bg} px-4 py-3 shadow-[var(--shadow-pop)]`}
            >
              <Icon className={`mt-0.5 h-4 w-4 ${variant.accent}`} />
              <p className="flex-1 text-[12.5px] leading-6 text-[var(--ink)]">
                {notice.message}
              </p>
              <button
                type="button"
                onClick={() => dismissNotice(notice.id)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)]"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
