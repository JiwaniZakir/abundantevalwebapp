"use client";

import { cn } from "@/lib/utils";

export function Section({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-micro uppercase tracking-wider text-[var(--fg-muted)]">{eyebrow}</p>
          )}
          <h3 className="text-title text-[var(--fg)]">{title}</h3>
          {description && (
            <p className="mt-1 text-caption text-[var(--fg-muted)] leading-relaxed">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass = {
    default: "text-[var(--fg)]",
    good: "text-[var(--green)]",
    warn: "text-[var(--amber)]",
    bad: "text-[var(--red)]",
  }[tone];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
      <p className="text-micro text-[var(--fg-muted)]">{label}</p>
      <p className={cn("mt-1 text-display tabular-nums", toneClass)}>{value}</p>
      {hint && <p className="mt-0.5 text-micro text-[var(--fg-faint)]">{hint}</p>}
    </div>
  );
}
