type SpinnerProps = {
  size?: "sm" | "md";
};

const sizeClassNames: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2"
};

export function Spinner({ size = "md" }: SpinnerProps) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-slate-300 border-t-slate-900 ${sizeClassNames[size]}`}
      aria-hidden="true"
    />
  );
}

