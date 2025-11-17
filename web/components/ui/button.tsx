import {
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode
} from "react";
import { cx } from "./cx";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  asChild?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const variantClassNames: Record<ButtonVariant, string> = {
  primary:
    "bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-900",
  secondary:
    "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 focus-visible:ring-slate-300",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-200"
};

export function Button({
  children,
  variant = "primary",
  className,
  asChild,
  ...props
}: ButtonProps) {
  const classes = cx(
    "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    variantClassNames[variant],
    className
  );

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement;
    return cloneElement(child, {
      ...props,
      className: cx(child.props.className, classes)
    });
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
