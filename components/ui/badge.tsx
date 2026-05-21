import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-[2px] text-[10px] font-medium uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--fg-muted)]",
        ink: "border-transparent bg-[var(--fg)] text-white",
        cream: "border-transparent bg-[var(--bg-muted)] text-[var(--fg)]",
        green: "border-transparent bg-[var(--green-soft)] text-[var(--green)]",
        amber: "border-transparent bg-[var(--amber-soft)] text-[var(--amber)]",
        red: "border-transparent bg-[var(--red-soft)] text-[var(--red)]",
        blue: "border-transparent bg-[var(--blue-soft)] text-[var(--blue)]",
        ghost: "border-transparent bg-transparent text-[var(--fg-muted)]",
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
