import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-[12.5px] font-medium tracking-[-0.005em] outline-none transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--ink)]/15",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--ink)] text-[var(--paper-pure)] hover:bg-[var(--ink-soft)] shadow-[0_1px_2px_rgba(20,20,20,0.18)]",
        secondary:
          "border border-[var(--hairline-strong)] bg-[var(--paper-pure)] text-[var(--ink)] hover:bg-[var(--paper)]",
        ghost: "text-[var(--ink-muted)] hover:bg-[var(--cream-soft)] hover:text-[var(--ink)]",
        outline:
          "border border-[var(--hairline-strong)] bg-transparent text-[var(--ink)] hover:bg-[var(--paper)]",
        cream:
          "bg-[var(--cream-soft)] text-[var(--ink)] hover:bg-[var(--cream-deep)]",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-7 px-3 text-[11.5px]",
        lg: "h-11 px-5 text-sm",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  if (asChild && React.isValidElement(props.children)) {
    const child = props.children as React.ReactElement<{ className?: string }>;

    return React.cloneElement(child, {
      className: cn(buttonVariants({ variant, size, className }), child.props.className),
    } as React.HTMLAttributes<HTMLElement>);
  }

  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { buttonVariants };
