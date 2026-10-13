import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { ConsentBanner } from "@/components/privacy/consent-banner";
import { JsonLd } from "@/components/seo/json-ld";
import { siteGraph } from "@/lib/seo/structured-data";
import { getSiteIdentity } from "@/lib/settings/public";
import { siteConfig } from "@/lib/site";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * The brand name, tagline and description are admin-editable overrides from the
 * `site_settings` table (see /admin/settings), falling back to the static
 * `siteConfig`. Reading them here means a saved change flows into every page's
 * `<title>` and meta description — including the `%s | Brand` template — once
 * the route is revalidated.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { name, tagline, description } = await getSiteIdentity();

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: `${name} — ${tagline}`,
      template: `%s | ${name}`,
    },
    description,
    applicationName: name,
    referrer: "strict-origin-when-cross-origin",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      type: "website",
      siteName: name,
      locale: "en_US",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // One request-memised read shared with `generateMetadata` and <Footer>.
  const identity = await getSiteIdentity();

  return (
    <html
      lang={siteConfig.locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <JsonLd data={siteGraph(identity)} />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <Header brandName={identity.name} />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
        <ConsentBanner />
        {/* Client-only; loads gtag.js only after the visitor consents AND the
            admin has enabled analytics. Renders nothing in server HTML. */}
        <GoogleAnalytics />
      </body>
    </html>
  );
}