// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { FaqAccordion } from "@/components/faq/faq-accordion";
import { faqItems } from "@/lib/content/faq";

/**
 * Pins the FAQ contract that the homepage depends on:
 *   - all questions and answers are in the rendered HTML, collapsed or not;
 *   - a trigger owns aria-expanded/aria-controls and toggles only its panel;
 *   - several panels can be open at once;
 *   - a collapsed panel is inert, so its links cannot be tabbed into.
 *
 * react-dom/client + act is used directly (no testing-library dependency),
 * matching the other component tests in this repo.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement;
let root: Root;

function triggerFor(id: string): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>(
    `#faq-trigger-${id}`,
  );
  if (!el) throw new Error(`no trigger rendered for ${id}`);
  return el;
}

function panelFor(id: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`#faq-panel-${id}`);
  if (!el) throw new Error(`no panel rendered for ${id}`);
  return el;
}

function click(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<FaqAccordion items={faqItems} />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("FaqAccordion", () => {
  it("renders every question and its answer text in the initial HTML", () => {
    expect(container.querySelectorAll("h3 > button")).toHaveLength(18);

    for (const item of faqItems) {
      const panel = panelFor(item.id);
      expect(panel.textContent ?? "").not.toBe("");
    }

    // Answers are crawlable without a click: the first answer's text is present
    // in the markup even though the panel starts collapsed.
    expect(container.innerHTML).toContain("uniformly random password");
  });

  it("starts collapsed with every panel inert", () => {
    for (const item of faqItems) {
      expect(triggerFor(item.id).getAttribute("aria-expanded")).toBe("false");
      expect(panelFor(item.id).hasAttribute("inert")).toBe(true);
    }
  });

  it("wires aria-controls to the panel it controls", () => {
    for (const item of faqItems) {
      const trigger = triggerFor(item.id);
      expect(trigger.getAttribute("aria-controls")).toBe(`faq-panel-${item.id}`);
      expect(panelFor(item.id).getAttribute("aria-labelledby")).toBe(
        trigger.id,
      );
    }
  });

  it("expands and collapses on repeated clicks", () => {
    const trigger = triggerFor(faqItems[0].id);

    click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(panelFor(faqItems[0].id).hasAttribute("inert")).toBe(false);

    click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(panelFor(faqItems[0].id).hasAttribute("inert")).toBe(true);
  });

  it("keeps several panels open simultaneously", () => {
    click(triggerFor(faqItems[0].id));
    click(triggerFor(faqItems[5].id));
    click(triggerFor(faqItems[17].id));

    expect(container.querySelectorAll('[aria-expanded="true"]')).toHaveLength(3);

    // Closing one leaves the others open.
    click(triggerFor(faqItems[5].id));
    expect(container.querySelectorAll('[aria-expanded="true"]')).toHaveLength(2);
  });

  it("closes only the panel whose question was clicked", () => {
    click(triggerFor(faqItems[1].id));

    expect(triggerFor(faqItems[0].id).getAttribute("aria-expanded")).toBe("false");
    expect(triggerFor(faqItems[2].id).getAttribute("aria-expanded")).toBe("false");
  });

  it("uses real buttons so keyboard activation and focus work", () => {
    const trigger = triggerFor(faqItems[0].id);
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("type")).toBe("button");
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
  });
});