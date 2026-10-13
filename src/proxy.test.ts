import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The proxy is the only place that can take the whole site offline, so the
 * maintenance gate is exercised end to end here: a stubbed settings read, a real
 * NextRequest, and the real `proxy` entry point.
 */
vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(async () => new Response(null, { status: 200 })),
}));

function stubSettings(rows: { key: string; value: unknown }[], ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(rows), {
        status: ok ? 200 : 500,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

async function loadProxy() {
  // Reset so the module-level maintenance cache does not leak between tests.
  vi.resetModules();
  return (await import("@/proxy")).proxy;
}

function navigate(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: { "sec-fetch-dest": "document", accept: "text/html" },
  });
}

describe("proxy — maintenance mode", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  });

  it("serves the site normally when maintenance is off", async () => {
    stubSettings([{ key: "maintenance_mode", value: false }]);
    const proxy = await loadProxy();

    const res = await proxy(navigate("/contact"));
    expect(res.status).toBe(200);
  });

  it("serves a 503 holding page for public navigations when maintenance is on", async () => {
    stubSettings([
      { key: "maintenance_mode", value: true },
      { key: "brand_name", value: "Acme" },
    ]);
    const proxy = await loadProxy();

    const res = await proxy(navigate("/contact"));
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("retry-after")).toBe("300");

    const html = await res.text();
    expect(html).toContain("Acme is temporarily unavailable");
  });

  it("never gates /admin, so the owner can switch maintenance back off", async () => {
    stubSettings([{ key: "maintenance_mode", value: true }]);
    const proxy = await loadProxy();

    const res = await proxy(navigate("/admin/settings"));
    // /admin redirects to /login for an unauthenticated visitor — never a 503.
    expect(res.status).not.toBe(503);
  });

  it("never gates API requests", async () => {
    stubSettings([{ key: "maintenance_mode", value: true }]);
    const proxy = await loadProxy();

    const res = await proxy(navigate("/api/analytics/config"));
    expect(res.status).not.toBe(503);
  });

  it("stays up when the settings read fails (fails closed)", async () => {
    stubSettings([], false);
    const proxy = await loadProxy();

    const res = await proxy(navigate("/"));
    expect(res.status).toBe(200);
  });
});
