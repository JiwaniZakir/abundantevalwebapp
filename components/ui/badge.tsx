import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10.5px] font-medium uppercase tracking-[0.08em]",
  {
    variants: {
      variant: {
        default: "border-[var(--hairline)] bg-[var(--paper)] text-[var(--ink-muted)]",
        ink: "border-transparent bg-[var(--ink)] text-[var(--paper-pure)]",
        cream: "border-transparent bg-[var(--cream-soft)] text-[var(--ink)]",
        green: "border-transparent bg-[var(--status-green-soft)] text-[var(--status-green)]",
        amber: "border-transparent bg-[var(--status-amber-soft)] text-[var(--status-amber)]",
        red: "border-transparent bg-[var(--status-red-soft)] text-[var(--status-red)]",
        blue: "border-transparent bg-[var(--status-blue-soft)] text-[var(--status-blue)]",
        ghost: "border-transparent bg-transparent text-[var(--ink-muted)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
