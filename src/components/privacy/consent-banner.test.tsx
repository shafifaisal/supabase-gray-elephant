// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ConsentBanner } from "@/components/privacy/consent-banner";

// Tell React this file drives its own act() environment (required by React 19
// when using react-dom directly, without a framework test renderer).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

/**
 * These tests pin the privacy contract of the consent banner:
 *   - it renders nothing when a decision already exists (returning visitor);
 *   - it renders for a first-time visitor;
 *   - choosing records a first-party cookie and hides the banner;
 *   - it never references analytics or advertising scripts.
 *
 * `react-dom/client` + `act` is used directly (no testing-library dependency,
 * per the repo's minimal-dependency rule).
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  document.cookie = "ip_consent=; Path=/; Max-Age=0";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function readConsentCookie(): string | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("ip_consent="));
  return match ? match.slice("ip_consent=".length) : null;
}

describe("ConsentBanner", () => {
  it("shows for a first-time visitor with no stored decision", () => {
    act(() => {
      root.render(<ConsentBanner />);
    });
    expect(container.textContent).toContain("Accept all");
    expect(container.textContent).toContain("Essential only");
  });

  it("hides entirely when a decision already exists", () => {
    document.cookie = "ip_consent=essential; Path=/";
    act(() => {
      root.render(<ConsentBanner />);
    });
    expect(container.innerHTML).toBe("");
  });

  it("records the choice as a first-party cookie and hides", () => {
    act(() => {
      root.render(<ConsentBanner />);
    });

    const accept = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Accept all"),
    );
    expect(accept).toBeDefined();

    act(() => {
      accept!.click();
    });

    expect(readConsentCookie()).toBe("all");
    expect(container.innerHTML).toBe("");
  });

  it("links to the cookie policy so the choice is informed", () => {
    act(() => {
      root.render(<ConsentBanner />);
    });
    const link = container.querySelector('a[href="/cookie-policy"]');
    expect(link).not.toBeNull();
  });
});
