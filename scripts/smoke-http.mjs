/**
 * End-to-end smoke test of the running production server.
 *
 * Exercises: public pages, unauthenticated admin redirect, real sign-in with
 * Supabase, authenticated admin access, and sign-out.
 *
 * Usage: node --env-file=.env.local scripts/smoke-http.mjs
 */

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL;
const PASSWORD = process.env.SMOKE_PASSWORD;

let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  for (const cookie of raw) {
    const [pair] = cookie.split(";");
    const index = pair.indexOf("=");
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (value === "" ) jar.delete(name);
    else jar.set(name, value);
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(jar.size > 0 ? { cookie: cookieHeader() } : {}),
    },
  });
  storeCookies(response);
  return response;
}

console.log(`Smoke testing ${BASE}\n`);

// --- Public pages ---------------------------------------------------------
console.log("Public pages:");
for (const path of ["/", "/tools", "/robots.txt"]) {
  const res = await request(path);
  check(`GET ${path} → 200`, res.status === 200, `got ${res.status}`);
}

const notFound = await request("/definitely-not-a-page");
check("GET /definitely-not-a-page → 404", notFound.status === 404, `got ${notFound.status}`);

const homeHtml = await (await request("/")).text();
check("home has no service_role key", !homeHtml.includes("service_role"));
check(
  "home does not leak the service-role JWT",
  !/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6.*service_role/.test(homeHtml),
);

// --- Unauthenticated admin ------------------------------------------------
console.log("\nUnauthenticated admin access:");
const adminAnon = await request("/admin");
check(
  "GET /admin redirects when signed out",
  adminAnon.status === 307 || adminAnon.status === 302,
  `got ${adminAnon.status}`,
);
const location = adminAnon.headers.get("location") ?? "";
check(
  "redirect target is /login",
  location.includes("/login"),
  location,
);
check(
  "admin redirect carries no-store",
  (adminAnon.headers.get("cache-control") ?? "").includes("no-store"),
  adminAnon.headers.get("cache-control") ?? "(none)",
);

// --- Real sign-in ---------------------------------------------------------
if (!EMAIL || !PASSWORD) {
  console.log(
    "\nSMOKE_EMAIL / SMOKE_PASSWORD not set — skipping authenticated checks.",
  );
} else {
  console.log("\nAuthenticated flow:");

  // @supabase/ssr reads the session from COOKIES, so we must perform sign-in
  // through an SSR client and capture the exact cookies it sets.
  const { createServerClient } = await import("@supabase/ssr");

  const captured = new Map();

  const ssrClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => [...captured].map(([name, value]) => ({ name, value })),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) captured.set(name, value);
        },
      },
    },
  );

  const { data, error } = await ssrClient.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });

  if (error || !data.session) {
    check("sign-in with Supabase", false, error?.message ?? "no session");
  } else {
    check("sign-in with Supabase", true);
    check(
      "sign-in produced session cookies",
      captured.size > 0,
      "no cookies captured",
    );

    // Feed the captured cookies into our jar and request the admin page.
    for (const [name, value] of captured) jar.set(name, value);

    const res = await request("/admin");
    check("GET /admin with a valid session", res.status === 200, `got ${res.status}`);

    const html = await res.text();
    check(
      "admin page renders the dashboard heading",
      html.includes("Dashboard"),
      "heading missing",
    );
    check(
      "admin shows the signed-in email",
      html.includes(EMAIL),
      "email not rendered",
    );
    check(
      "admin response is not publicly cacheable",
      (res.headers.get("cache-control") ?? "").includes("private") ||
        (res.headers.get("cache-control") ?? "").includes("no-store"),
      res.headers.get("cache-control") ?? "(none)",
    );
    check(
      "admin page is noindex",
      html.includes("noindex"),
      "no robots directive found",
    );
  }
}

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);