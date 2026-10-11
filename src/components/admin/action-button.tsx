"use client";

import { useFormStatus } from "react-dom";

/** Submit button that reflects pending state for the surrounding form. */
export function ActionButton({
  children,
  variant = "primary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "danger" | "ghost";
}) {
  const { pending } = useFormStatus();

  const base =
    "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-60";

  const styles = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    danger:
      "border border-danger/50 text-danger hover:bg-danger/10",
    ghost: "border border-border hover:bg-secondary",
  }[variant];

  return (
    <button type="submit" disabled={pending} className={`${base} ${styles}`}>
      {pending ? "Working…" : children}
    </button>
  );
}