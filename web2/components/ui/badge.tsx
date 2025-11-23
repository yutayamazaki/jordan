import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

type BadgeVariant = "default" | "success" | "destructive";

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
} & HTMLAttributes<HTMLSpanElement>;

const variantClassNames: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-700 border border-slate-200",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  destructive: "bg-rose-50 text-rose-700 border border-rose-200"
};

export function Badge({
  children,
  variant = "default",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variantClassNames[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

