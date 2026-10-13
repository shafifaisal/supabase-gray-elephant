// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { SettingsManager } from "@/components/admin/settings-manager";

/**
 * Regression tests for the settings editor.
 *
 * The original bug: every setting lived inside ONE <form>, so the form held many
 * inputs named `key`/`value`. FormData.get() returns only the FIRST match, so the
 * save action always wrote the first preset (brand_name) and every other setting,
 * including `analytics_enabled`, silently reverted to its default.
 *
 * These tests pin the fix: each setting is its own form carrying exactly one
 * `key` and one `value`, so submitting a field sends that field's own pair.
 *
 * react-dom/client + act is used directly (no testing-library dependency).
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement;
let root: Root;

const action =
  vi.fn<(state: unknown, formData: FormData) => Promise<{ success: true }>>(
    async () => ({ success: true }),
  );

const PRESETS = [
  {
    key: "brand_name",
    label: "Brand name",
    hint: "hint",
    value: "iPassGenerator",
  },
  {
    key: "analytics_enabled",
    label: "Enable analytics",
    hint: "hint",
    value: "false",
  },
];

beforeEach(() => {
  action.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render(): Promise<void> {
  await act(async () => {
    root.render(
      <SettingsManager action={action} presets={PRESETS} existing={[]} />,
    );
  });
}

/** The form whose hidden `key` input carries the given setting key. */
function formFor(key: string): HTMLFormElement {
  const hidden = container.querySelector<HTMLInputElement>(
    `input[type="hidden"][name="key"][value="${key}"]`,
  );
  const form = hidden?.closest("form");
  if (!form) throw new Error(`no form found for ${key}`);
  return form;
}

function submittedFormData(call: number): FormData {
  const arg = action.mock.calls[call]?.[1];
  if (!(arg instanceof FormData)) throw new Error("action got no FormData");
  return arg;
}

describe("SettingsManager", () => {
  it("gives each setting its own form with a single key/value pair", async () => {
    await render();

    const form = formFor("analytics_enabled");
    const keys = form.querySelectorAll('input[name="key"]');
    const values = form.querySelectorAll('input[name="value"]');
    expect(keys).toHaveLength(1);
    expect(values).toHaveLength(1);
  });

  it("saves the edited setting, not the first field in the form", async () => {
    await render();

    const form = formFor("analytics_enabled");
    const valueInput = form.querySelector<HTMLInputElement>(
      'input[name="value"]',
    );
    if (!valueInput) throw new Error("no value input");

    await act(async () => {
      valueInput.value = "true";
    });
    await act(async () => {
      form.requestSubmit();
    });

    expect(action).toHaveBeenCalledTimes(1);
    const fd = submittedFormData(0);
    expect(fd.get("key")).toBe("analytics_enabled");
    expect(fd.get("value")).toBe("true");
  });

  it("lets the custom form submit an arbitrary key and value", async () => {
    await render();

    const keyInput = container.querySelector<HTMLInputElement>(
      'input[name="key"]:not([type="hidden"])',
    );
    const valueInput = keyInput
      ?.closest("form")
      ?.querySelector<HTMLInputElement>('input[name="value"]');
    if (!keyInput || !valueInput) throw new Error("custom form not found");

    await act(async () => {
      keyInput.value = "footer_text";
      valueInput.value = "Hello";
    });
    await act(async () => {
      keyInput.closest("form")!.requestSubmit();
    });

    const fd = submittedFormData(0);
    expect(fd.get("key")).toBe("footer_text");
    expect(fd.get("value")).toBe("Hello");
  });
});
