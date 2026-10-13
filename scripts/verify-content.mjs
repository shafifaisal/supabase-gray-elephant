/**
 * Verifies the article publishing workflow end to end against the live
 * database: draft visibility, publication, slug routing and the sitemap.
 *
 * Creates its own fixtures, publishes one temporarily, asserts the public
 * behaviour, then restores the original state.
 *
 * Usage: node --env-file=.env.local scripts/verify-content.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

const stamp = Date.now();
const DRAFT_SLUG = `verify-draft-${stamp}`;
const PUBLISHED_SLUG = `verify-published-${stamp}`;

async function createFixture(slug, status, publishedAt) {
  const { data, error } = await admin
    .from("articles")
    .insert({
      slug,
      title: `Verification fixture ${slug}`,
      excerpt: "Temporary fixture used to verify the publishing workflow.",
      body_md: "## Heading\n\nBody text for verification.",
      body_html: "<h2>Heading</h2><p>Body text for verification.</p>",
      status,
      published_at: publishedAt,
      is_noindex: false,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

let draftId;
let publishedId;

try {
  console.log("Creating fixtures...\n");
  draftId = await createFixture(DRAFT_SLUG, "draft", null);
  publishedId = await createFixture(PUBLISHED_SLUG, "published", new Date(Date.now() - 60_000).toISOString());

  // --- Anon visibility -------------------------------------------------
  console.log("Anonymous visibility:");
  const { data: visible } = await anon
    .from("articles")
    .select("slug")
    .eq("slug", DRAFT_SLUG);

  check("draft is invisible to the anonymous role", (visible ?? []).length === 0);

  const { data: pub } = await anon
    .from("articles")
    .select("slug")
    .eq("slug", PUBLISHED_SLUG);

  check("published article is visible to the anonymous role", (pub ?? []).length === 1);

  // --- Public pages ----------------------------------------------------
  console.log("\nPublic routes:");
  const draftRes = await fetch(`${site}/guides/${DRAFT_SLUG}`, { redirect: "manual" });
  const draftHtml = await draftRes.text();

  // SECURITY-CRITICAL: a draft's CONTENT must never appear in the response.
  //
  // Note: the slug itself does appear, because Next serialises route params
  // into the RSC flight payload. That is the URL the visitor already typed and
  // reveals nothing. What must never appear is the title or body text.
  check(
    "draft title never reaches the response body",
    !draftHtml.includes("Verification fixture"),
    "DRAFT TITLE LEAKED",
  );
  check(
    "draft body never reaches the response body",
    !draftHtml.includes("Body text for verification"),
    "DRAFT BODY LEAKED",
  );
  check(
    "draft URL renders the not-found experience",
    /couldn.?t find|404|not found/i.test(draftHtml),
  );

  // FIXED IN PHASE 6: with cacheComponents disabled, the article route resolves
  // its data before streaming, so notFound() commits a REAL 404 status. This is
  // now a hard assertion — a draft URL served as 200 would be a soft 404 that
  // search engines treat as a valid page.
  check(
    "draft URL returns a real 404 status (not a soft 404)",
    draftRes.status === 404,
    `got ${draftRes.status}`,
  );

  const pubRes = await fetch(`${site}/guides/${PUBLISHED_SLUG}`, { redirect: "manual" });
  check("published URL returns 200", pubRes.status === 200, `got ${pubRes.status}`);

  const missingRes = await fetch(`${site}/guides/no-such-article-${stamp}`, { redirect: "manual" });
  const missingHtml = await missingRes.text();
  check(
    "unknown slug reveals no content",
    !missingHtml.includes("Verification fixture"),
  );

  // --- SEO metadata ----------------------------------------------------
  console.log("\nSEO metadata:");
  const html = await pubRes.text();

  check("has a canonical URL", html.includes(`rel="canonical"`), "missing");
  check(
    "canonical points at the article",
    html.includes(`/guides/${PUBLISHED_SLUG}`),
    "wrong canonical",
  );
  check("has exactly one h1", (html.match(/<h1/g) ?? []).length === 1);
  check(
    "contains Article structured data",
    html.includes('"@type":"Article"') || html.includes('"@type": "Article"'),
  );
  check("has noindex absent (indexable)", !/<meta name="robots" content="noindex/.test(html));

  // --- Sitemap ---------------------------------------------------------
  console.log("\nSitemap:");
  const sitemap = await (await fetch(`${site}/sitemap.xml`)).text();
  check("includes the published article", sitemap.includes(`/guides/${PUBLISHED_SLUG}`));
  check("excludes the draft article", !sitemap.includes(DRAFT_SLUG));
  check("excludes /admin", !sitemap.includes("/admin"));
  check("excludes /login", !sitemap.includes("/login"));

  // --- Category listing ------------------------------------------------
  console.log("\nCategories:");
  const catsRes = await fetch(`${site}/guides`, { redirect: "manual" });
  check("guides index returns 200", catsRes.status === 200, `got ${catsRes.status}`);

  const badCat = await fetch(`${site}/guides/category/nope-${stamp}`, { redirect: "manual" });
  const badCatHtml = await badCat.text();
  check(
    "unknown category renders the not-found experience",
    /couldn.?t find|404|not found/i.test(badCatHtml),
  );

  // --- XSS in rendered content -----------------------------------------
  console.log("\nSanitisation:");
  const xssSlug = `verify-xss-${stamp}`;
  const { data: xssArticle } = await admin
    .from("articles")
    .insert({
      slug: xssSlug,
      title: "XSS fixture",
      body_md: "hello",
      body_html: '<h2>ok</h2><script>window.__pwned=1</script><img src=x onerror="window.__pwned=1">',
      status: "published",
      published_at: new Date(Date.now() - 60_000).toISOString(),
    })
    .select("id")
    .single();

  const xssRes = await fetch(`${site}/guides/${xssSlug}`, { redirect: "manual" });
  const xssHtml = await xssRes.text();

  check("served page contains no script tag", !xssHtml.includes("window.__pwned"), "XSS leaked");
  check("served page has no onerror handler", !xssHtml.includes("onerror"), "onerror leaked");

  await admin.from("articles").delete().eq("id", xssArticle.id);

  // --- Phase 6: legal pages, site structured data, breadcrumbs -----------
  console.log("\nLegal pages and site structured data:");

  for (const [path, heading] of [
    ["/privacy-policy", /Privacy Policy/i],
    ["/terms", /Terms of Use/i],
    ["/cookie-policy", /Cookie Policy/i],
  ]) {
    const res = await fetch(`${site}${path}`, { redirect: "manual" });
    const html = await res.text();
    check(`${path} returns 200`, res.status === 200, `got ${res.status}`);
    check(`${path} has its heading`, heading.test(html));
    check(`${path} shows a last-updated date`, /Last updated/i.test(html));
    check(`${path} has a canonical URL`, html.includes('rel="canonical"'));
    check(`${path} is indexable`, !/<meta name="robots" content="noindex/i.test(html));
  }

  const homeHtml = await (await fetch(`${site}/`, { redirect: "manual" })).text();
  check(
    "home emits Organization structured data",
    /"@type":"Organization"|"@type": "Organization"/.test(homeHtml),
  );
  check(
    "home emits WebSite structured data",
    /"@type":"WebSite"|"@type": "WebSite"/.test(homeHtml),
  );

  // `html` (read above) is the published article page; reuse it rather than
  // re-reading a Response body, which can only be consumed once.
  check(
    "article emits BreadcrumbList structured data",
    /"@type":"BreadcrumbList"|"@type": "BreadcrumbList"/.test(html),
  );

  // Privacy: the consent banner is client-only (server snapshot hides it), so
  // no analytics/ad script and no consent UI is present in the served HTML.
  check(
    "no third-party analytics/ads script in served HTML",
    !/googletagmanager|google-analytics|adsbygoogle|ga\(/i.test(homeHtml),
  );

  // --- Phase 7: AdSense fails closed until configured + consented ---------
  console.log("\nAdSense (Phase 7):");
  const adsRes = await fetch(`${site}/api/ads/config`, { redirect: "manual" });
  const adsJson = await adsRes.json();
  check("ads config endpoint returns 200", adsRes.status === 200, `got ${adsRes.status}`);
  check("ads config is not cached", adsRes.headers.get("cache-control")?.includes("no-store"));
  // With no real publisher ID configured, ads must report not-ready and must
  // NEVER return a fabricated publisher ID.
  check("ads are not ready without configuration", adsJson.ready === false);
  check("ads config returns a null publisher ID when not ready", adsJson.publisherId === null);
  check("ads config declares consent is still required", adsJson.consentRequired === true);

  const guidesHtml = await (await fetch(`${site}/guides`, { redirect: "manual" })).text();
  check(
    "guides page contains no AdSense script while ads are off",
    !/pagead2\.googlesyndication|adsbygoogle/i.test(guidesHtml),
  );

  // --- Analytics: consent-gated, fails closed without a valid GA4 id --------
  console.log("\nAnalytics:");
  const analyticsRes = await fetch(`${site}/api/analytics/config`, {
    redirect: "manual",
  });
  const analyticsJson = await analyticsRes.json();
  check(
    "analytics config endpoint returns 200",
    analyticsRes.status === 200,
    `got ${analyticsRes.status}`,
  );
  check(
    "analytics config is not cached",
    analyticsRes.headers.get("cache-control")?.includes("no-store"),
  );
  check(
    "analytics declares consent is still required",
    analyticsJson.consentRequired === true,
  );
  // The measurement id is either null (disabled) or a real-looking GA4 id. It is
  // NEVER fabricated, and it never appears in served HTML (client-injected only
  // after consent — asserted by the "no third-party analytics/ads script" check).
  check(
    "analytics measurement id is null or a valid GA4 id",
    analyticsJson.measurementId === null ||
      /^G-[A-Z0-9]{4,}$/.test(analyticsJson.measurementId),
  );
} finally {
  console.log("\nCleaning up fixtures...");
  for (const id of [draftId, publishedId].filter(Boolean)) {
    await admin.from("articles").delete().eq("id", id);
  }
}

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);