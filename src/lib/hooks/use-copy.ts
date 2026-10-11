"use client";

import { useCallback, useState } from "react";

/**
 * Copy-to-clipboard with a visible, announced confirmation.
 *
 * Never logs or transmits the value.
 */
export function useCopyToClipboard(resetAfterMs = 2000) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = useCallback(
    async (value: string) => {
      if (!value) return;

      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setError(null);
      } catch {
        // Fallback for browsers without the async clipboard API, or when the
        // page is not in a secure context.
        try {
          const textarea = document.createElement("textarea");
          textarea.value = value;
          textarea.setAttribute("readonly", "");
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(textarea);
          if (!ok) throw new Error("copy failed");
          setCopied(true);
          setError(null);
        } catch {
          setError("Could not copy. Select the text and copy manually.");
        }
      }

      window.setTimeout(() => {
        setCopied(false);
        setError(null);
      }, resetAfterMs);
    },
    [resetAfterMs],
  );

  return { copy, copied, error };
}