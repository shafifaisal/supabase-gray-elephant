import type { Metadata } from "next";
import Link from "next/link";

import { ArticleCard } from "@/components/articles/article-card";
import { Card, SectionHeading } from "@/components/ui/primitives";
import { getPublishedArticles } from "@/lib/content/articles";
import { getPublicMediaMap } from "@/lib/media/urls";
import { siteConfig } from "@/lib/site";
import { toolPath, tools } from "@/lib/tools";

export const metadata: Metadata = {
  title: { absolute: "Instant Password Generator - Free Tool Secure & Reliable" },
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const latestArticles = await getPublishedArticles(3);
  const latestMedia = await getPublicMediaMap(
    latestArticles.map((article) => article.featured_image_id),
  );

  return (
    <>
      <section className="relative isolate w-full overflow-hidden border-b border-border bg-[#04070f] text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-[url('/hero-banner.jpg')] bg-cover bg-center bg-no-repeat"
        />
        <div className="container-page py-16 sm:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold tracking-wide text-sky-300 uppercase">
              Runs entirely in your browser
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl">
              Strong passwords, without uploading anything
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-white/80">
              Generate passwords, passphrases and random strings using your
              device&rsquo;s cryptographic random number generator. Nothing is sent
              to a server, saved to storage or written to a log.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={toolPath(tools[0].slug)}
                className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Generate a password
              </Link>
              <Link
                href="/tools"
                className="inline-flex h-11 items-center justify-center rounded-md border border-white/25 bg-white/10 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                Browse all tools
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <SectionHeading
          title="Every tool, one guarantee"
          description="Each utility is implemented with the Web Crypto API and unbiased character selection. Generated values are held in component state only and are never transmitted."
        />

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <li key={tool.slug}>
              <Card className="flex h-full flex-col">
                <h3 className="text-lg font-semibold">
                  <Link
                    href={toolPath(tool.slug)}
                    className="rounded after:absolute after:inset-0"
                  >
                    {tool.name}
                  </Link>
                </h3>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">
                  {tool.summary}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {latestArticles.length > 0 ? (
        <section className="container-page border-t border-border py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              title="Latest articles"
              description="Practical guidance on password strength, passphrases, password managers and account recovery."
            />
            <Link
              href="/articles"
              className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              View all articles
            </Link>
          </div>

          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latestArticles.map((article) => (
              <li key={article.id}>
                <ArticleCard
                  article={article}
                  image={
                    article.featured_image_id
                      ? latestMedia.get(article.featured_image_id) ?? null
                      : null
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="border-t border-border bg-secondary/30">
        <div className="container-page py-16">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <SectionHeading
                title="Why a browser-based generator?"
                description="Password generation is one of the few security tasks that genuinely should never touch a network."
              />
              <ul className="mt-6 space-y-4 text-muted-foreground">
                <li className="flex gap-3">
                  <span className="font-bold text-primary" aria-hidden="true">
                    01
                  </span>
                  <span>
                    <strong className="text-foreground">
                      No server round-trip.
                    </strong>{" "}
                    A generated password that is transmitted can be logged, cached
                    or intercepted. Ours never is.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-primary" aria-hidden="true">
                    02
                  </span>
                  <span>
                    <strong className="text-foreground">
                      Cryptographic randomness.
                    </strong>{" "}
                    Values come from <code>crypto.getRandomValues()</code> with
                    rejection sampling to remove modulo bias.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-primary" aria-hidden="true">
                    03
                  </span>
                  <span>
                    <strong className="text-foreground">No storage.</strong>{" "}
                    Generated secrets are never written to cookies, local storage or
                    the URL.
                  </span>
                </li>
              </ul>
            </div>

            <Card className="self-start">
              <h3 className="text-lg font-semibold">Not sure where to start?</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Read the articles for practical habits: how much randomness you
                actually need, when a passphrase beats a random string, and why
                length matters more than symbol soup.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/articles"
                  className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-semibold transition-colors hover:bg-secondary"
                >
                  Read the articles
                </Link>
                <Link
                  href="/about"
                  className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-semibold transition-colors hover:bg-secondary"
                >
                  About this project
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}