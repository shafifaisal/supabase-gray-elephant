"use client";

import { useCallback, useState } from "react";

import type { FaqItem } from "@/lib/content/faq";

/**
 * Vertically stacked, independently collapsible FAQ accordion.
 *
 * Accessibility and SEO decisions worth knowing before editing:
 *
 * - Every panel is present in the server-rendered HTML at all times. Collapse
 *   is done with a 0fr grid row plus `inert`, not conditional rendering, so
 *   crawlers and readers without JS see the answers.
 * - `inert` on a collapsed panel keeps it out of the tab order and the
 *   accessibility tree, which stops keyboard focus from scrolling into clipped
 *   content. Without it, the links inside collapsed answers stay focusable.
 * - Each panel is a labelled `region`; the trigger owns `aria-expanded` and
 *   points at the panel through `aria-controls`. Triggers are real buttons, so
 *   Enter/Space activation and the global `:focus-visible` ring come for free —
 *   no custom key handling to keep in sync.
 * - The open set is a Set of ids, so any number of panels can be open at once.
 * - `motion-reduce` disables the transition; globals.css also collapses all
 *   transition durations under prefers-reduced-motion.
 */
export function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
      {items.map((item) => {
        const open = openIds.has(item.id);
        const triggerId = `faq-trigger-${item.id}`;
        const panelId = `faq-panel-${item.id}`;

        return (
          <div key={item.id} className="border-b border-border last:border-b-0">
            <h3>
              <button
                type="button"
                id={triggerId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                className="flex w-full cursor-pointer items-start justify-between gap-4 px-4 py-5 text-left text-base font-semibold transition-colors hover:bg-secondary/50 sm:px-6 sm:text-lg"
              >
                <span>{item.question}</span>
                <Chevron open={open} />
              </button>
            </h3>

            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              inert={!open}
              className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
                open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="space-y-3 px-4 pb-6 text-sm leading-relaxed text-muted-foreground sm:px-6 sm:text-base">
                  {item.answer}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Small chevron that points down when collapsed and up when expanded.
 *
 * Tailwind v4 emits `rotate: 180deg` (the standalone CSS `rotate` property)
 * rather than a `transform`, so the transition is declared on `rotate` — a
 * `transition-transform` would snap the chevron instead of turning it.
 */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-[rotate] duration-200 motion-reduce:transition-none ${
        open ? "rotate-180" : ""
      }`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}