import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * cacheComponents is deliberately DISABLED.
   *
   * With it enabled, Next partially prerenders routes: the static shell is
   * flushed with a 200 status before the page body resolves. That makes it
   * impossible for a page to call `notFound()` before the status is committed,
   * so draft and unknown article URLs were served as HTTP 200 with a 404 body —
   * a "soft 404", which search engines treat as a valid page.
   *
   * This is a CMS where correct HTTP status codes matter more than shaving
   * latency off static output. With cacheComponents off:
   *   * `notFound()` sets a real 404 status.
   *   * Per-route caching is expressed explicitly with `dynamic` and
   *     `revalidate`, which is clearer to reason about than partial prerender.
   *   * Public content still benefits from the `"use cache"` data layer and
   *     `revalidatePath` invalidation on publish.
   *
   * Re-enabling this flag requires re-testing that /guides/[slug] and
   * /guides/category/[slug] return 404. See docs/status.md.
   */
  cacheComponents: false,

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  /**
   * Article featured images are served from Supabase Storage's public bucket,
   * whose host is `<project-ref>.supabase.co`. Allowing that wildcard lets the
   * Next.js image optimizer resize and cache them without hard-coding a
   * project ref, so the same configuration works in every environment.
   */
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },

  // Security headers applied to every response.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;