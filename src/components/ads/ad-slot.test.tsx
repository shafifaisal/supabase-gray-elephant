// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { AdSlot } from "@/components/ads/ad-slot";

/**
 * These tests pin the AdSlot privacy contract (AGENTS.md §4):
 *   - not configured  → renders nothing at all (no script, no <ins>);
 *   - configured but no consent → inert placeholder, NO <ins>, NO script;
 *   - configured + consent → renders the <ins> unit and injects the script;
 *   - the injected script URL carries the publisher ID and nothing else secret.
 *
 * react-dom/client + act is used directly (no testing-library dependency).
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement;
let root: Root;

function setConsent(value: "all" | "essential" | ""): void {
  if (value === "") {
    document.cookie = "ip_consent=; Path=/; Max-Age=0";
  } else {
    document.cookie = `ip_consent=${value}; Path=/`;
  }
}

beforeEach(() => {
  document.head.innerHTML = "";
  document.cookie = "ip_consent=; Path=/; Max-Age=0";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const PUB = "ca-pub-1234567890123456";

describe("AdSlot", () => {
  it("renders nothing when ads are not configured", () => {
    act(() => {
      root.render(
        <AdSlot ready={false} publisherId={null} slot="0000000001" />,
      );
    });
    expect(container.innerHTML).toBe("");
    expect(document.getElementById("adsbygoogle-js")).toBeNull();
  });

  it("renders an inert placeholder with NO script when not consented", () => {
    setConsent("essential");
    act(() => {
      root.render(<AdSlot ready publisherId={PUB} slot="0000000001" />);
    });
    // No <ins> ad unit and no injected script before consent.
    expect(container.querySelector("ins.adsbygoogle")).toBeNull();
    expect(document.getElementById("adsbygoogle-js")).toBeNull();
    // An honest, inert message is shown instead.
    expect(container.textContent).toContain("hidden until you accept");
  });

  it("renders the ad unit and injects the script only after consent", () => {
    setConsent("all");
    act(() => {
      root.render(<AdSlot ready publisherId={PUB} slot="0000000001" />);
    });

    const ins = container.querySelector("ins.adsbygoogle");
    expect(ins).not.toBeNull();
    expect(ins?.getAttribute("data-ad-client")).toBe(PUB);
    expect(ins?.getAttribute("data-ad-slot")).toBe("0000000001");

    const script = document.getElementById("adsbygoogle-js");
    expect(script).not.toBeNull();
    expect(script?.getAttribute("src")).toContain(
      `client=${encodeURIComponent(PUB)}`,
    );
    expect(script?.getAttribute("src")).toContain("pagead2.googlesyndication.com");
  });

  it("labels the unit so ads are distinguishable from content", () => {
    setConsent("all");
    act(() => {
      root.render(<AdSlot ready publisherId={PUB} slot="0000000001" />);
    });
    const aside = container.querySelector("aside");
    expect(aside?.getAttribute("aria-label")).toBe("Advertisement");
    expect(container.textContent?.toUpperCase()).toContain("ADVERTISEMENT");
  });
});
