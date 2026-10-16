// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { GoogleAnalytics } from "@/components/analytics/google-analytics";

/**
 * These tests pin the Google Analytics privacy contract (AGENTS.md §4):
 *   - NO consent      → no request at all, no script (declined = zero traffic);
 *   - consent but analytics disabled by admin/env → no script;
 *   - consent + enabled → injects gtag.js with the measurement ID, once.
 *
 * react-dom/client + act is used directly (no testing-library dependency), the
 * same approach as the AdSlot test.
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

function mockConfig(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  } as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function render(): Promise<void> {
  await act(async () => {
    root.render(<GoogleAnalytics />);
  });
}

beforeEach(() => {
  document.head.innerHTML = "";
  document.cookie = "ip_consent=; Path=/; Max-Age=0";
  delete (window as { dataLayer?: unknown }).dataLayer;
  delete (window as { gtag?: unknown }).gtag;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GoogleAnalytics", () => {
  it("makes NO request and injects nothing when no decision is recorded", async () => {
    setConsent("");
    const fetchMock = mockConfig({ enabled: true, measurementId: "G-FM1QKB6H5P" });
    await render();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.getElementById("ga-gtag-js")).toBeNull();
  });

  it("respects 'essential only' consent — no request, no script", async () => {
    setConsent("essential");
    const fetchMock = mockConfig({ enabled: true, measurementId: "G-FM1QKB6H5P" });
    await render();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.getElementById("ga-gtag-js")).toBeNull();
  });

  it("injects gtag.js only after consent AND when the server says enabled", async () => {
    setConsent("all");
    const fetchMock = mockConfig({ enabled: true, measurementId: "G-FM1QKB6H5P" });
    await render();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics/config",
      expect.objectContaining({ cache: "no-store" }),
    );

    const script = document.getElementById("ga-gtag-js");
    expect(script).not.toBeNull();
    expect(script?.getAttribute("src")).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-FM1QKB6H5P",
    );

    const dataLayer = (window as { dataLayer?: unknown[] }).dataLayer;
    expect(dataLayer?.[0]).toEqual(["js", expect.any(Date)]);
    expect(dataLayer?.[1]).toEqual(["config", "G-FM1QKB6H5P"]);
  });

  it("injects nothing when the admin toggle / env leaves analytics disabled", async () => {
    setConsent("all");
    mockConfig({ enabled: false, measurementId: null });
    await render();
    expect(document.getElementById("ga-gtag-js")).toBeNull();
    expect((window as { dataLayer?: unknown[] }).dataLayer).toBeUndefined();
  });

  it("injects at most one script even across re-renders", async () => {
    setConsent("all");
    mockConfig({ enabled: true, measurementId: "G-FM1QKB6H5P" });
    await render();
    await act(async () => {
      root.render(<GoogleAnalytics />);
    });
    expect(document.querySelectorAll("#ga-gtag-js").length).toBe(1);
    expect(document.querySelectorAll('script[src*="googletagmanager"]').length).toBe(1);
  });
});
