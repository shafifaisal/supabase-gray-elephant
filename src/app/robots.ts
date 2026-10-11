import type { MetadataRoute } from "next";

import { absoluteUrl, siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const disallow = ["/admin", "/admin/", "/api/", "/login", "/auth/"];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: disallow,
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteConfig.url,
  };
}