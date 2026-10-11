"use client";

import type { ReactNode } from "react";

/** Shared toggle button used for show/hide controls. */
export function VisibilityToggle({
  visible,
  onToggle,
  label,
}: {
  visible: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={visible}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border transition-colors hover:bg-secondary"
    >
      {visible ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M3 3l18 18" />
          <path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-2.6 3.3" />
          <path d="M6.6 6.7A17 17 0 0 0 2 12s3.5 6 10 6a9.7 9.7 0 0 0 4.3-1" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </svg>
      )}
    </button>
  );
}

/** Displays a generated secret with optional reveal and copy controls. */
export function SecretField({
  label,
  value,
  children,
  actions,
}: {
  label: string;
  value: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor="generated-secret"
        className="mb-1.5 block text-sm font-medium"
      >
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        {children}
        {actions ? <div className="flex gap-2">{actions}</div> : null}
      </div>
      {/* Announce the value change without reading the secret aloud. */}
      <p className="sr-only" role="status" aria-live="polite">
        {value ? "A new value has been generated." : ""}
      </p>
    </div>
  );
}

/** Formatted entropy readout. */
export function EntropyMeter({
  bits,
  label,
  tone,
  guidance,
}: {
  bits: number;
  label: string;
  tone: "danger" | "warning" | "success";
  guidance: string;
}) {
  // A 128-bit scale makes the bar meaningful rather than decorative.
  const percent = Math.min(100, (bits / 128) * 100);

  const barColour =
    tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-danger";

  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="font-mono text-sm font-bold">{bits.toFixed(1)} bits</span>
      </div>

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary"
        role="meter"
        aria-valuenow={Math.round(bits)}
        aria-valuemin={0}
        aria-valuemax={128}
        aria-label="Estimated entropy in bits"
      >
        <div
          className={`h-full rounded-full transition-[width] ${barColour}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{guidance}</p>
    </div>
  );
}

/** Standard error banner for validation failures. */
export function ErrorMessage({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
    >
      {children}
    </p>
  );
}