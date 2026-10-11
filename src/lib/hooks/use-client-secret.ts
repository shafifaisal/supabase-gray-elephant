"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Generates a value on the client only, never during server rendering.
 *
 * WHY THIS EXISTS
 * ---------------
 * Next.js refuses to prerender a Client Component that calls
 * `crypto.getRandomValues()` during render, and rightly so: a generated secret
 * must never appear in server-rendered HTML, in the RSC payload, or in any
 * cache. Generating inside an effect guarantees the value exists only after
 * hydration, in the user's browser.
 *
 * The displayed value starts empty and is filled immediately on mount.
 */
export function useClientSecret<T>(
  generate: () => T,
  initialValue: T,
): { value: T; regenerate: () => void } {
  const [value, setValue] = useState<T>(initialValue);

  // Generate once on mount, and again whenever `generate` changes identity.
  //
  // The react-hooks/set-state-in-effect rule is suppressed deliberately: this
  // is a genuine side effect (reading the CSPRNG), not derived state. Deriving
  // it during render would be wrong — it would run on the server and put a
  // secret into the prerendered HTML.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(generate());
  }, [generate]);

  const regenerate = useCallback(() => {
    setValue(generate());
  }, [generate]);

  return { value, regenerate };
}