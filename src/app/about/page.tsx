import type { Metadata } from "next";
import Link from "next/link";

import { Prose } from "@/components/ui/primitives";
import { siteConfig } from "@/lib/site";
import { tools } from "@/lib/tools";
import { toolPath } from "@/lib/tools";
import { WORDLIST_ATTRIBUTION } from "@/lib/crypto/wordlist";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why this site exists, exactly how the tools work in your browser, and what we do and do not collect.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="container-page py-10">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">About</h1>

        <Prose>
          <p className="text-lg text-muted-foreground">
            {siteConfig.name} exists because generating a password should not
            require trusting a stranger&rsquo;s server with the result.
          </p>

          <h2>How the tools work</h2>
          <p>
            Every generator on this site runs entirely in your browser using the
            Web Crypto API, the same primitive your browser uses for TLS. When
            you press generate, the page calls{" "}
            <code>crypto.getRandomValues()</code> to produce random values, and
            those values are turned into characters in your device&rsquo;s
            memory.
          </p>
          <p>
            Nothing is sent anywhere. There is no form submission, no
            analytics event carrying the value, no logging, and no database
            column for it. You can confirm this: open your browser&rsquo;s
            network tab while using a tool and watch it stay empty. Open
            DevTools, go to Application &rarr; Storage, and see that nothing is
            written.
          </p>

          <h2>Correct randomness, carefully</h2>
          <p>
            Most &ldquo;random&rdquo; generators are subtly biased. Mapping a
            random number onto a set of characters with a modulo operation makes
            the first characters in the set slightly more likely than the last.
            We avoid that with rejection sampling: values that fall outside an
            even range are discarded and redrawn.
          </p>
          <p>
            Generated passwords are then shuffled with a Fisher-Yates pass
            driven by the same cryptographic source, so the characters that were
            inserted to satisfy the &ldquo;include one of each type&rdquo;
            requirement do not sit in predictable positions.
          </p>

          <h2>What we do not do</h2>
          <ul>
            <li>We never ask for, receive or store your password.</li>
            <li>
              We never claim a password is &ldquo;safe&rdquo; — every estimate on
              this site is explicitly an approximation.
            </li>
            <li>We do not sell, broker or share any information about visitors.</li>
          </ul>

          <h2>Third-party components</h2>
          <p>
            The strength checker uses the Dropbox zxcvbn algorithm through a
            maintained TypeScript port, and the passphrase generator uses the
            EFF large word list. Both run locally.
          </p>
          <p className="text-sm text-muted-foreground">
            Word list: {WORDLIST_ATTRIBUTION}.
          </p>

          <h2>Corrections</h2>
          <p>
            Security writing ages badly. If something here is inaccurate or
            out of date, please{" "}
            <Link href="/contact" className="underline underline-offset-2">
              tell us
            </Link>
            {" "}
            and we will fix it.
          </p>
        </Prose>

        <section className="mt-10 rounded-[var(--radius-card)] border border-border bg-secondary/40 p-5">
          <h2 className="text-sm font-semibold">Tools on this site</h2>
          <ul className="mt-3 space-y-1">
            {tools.map((tool) => (
              <li key={tool.slug}>
                <Link
                  href={toolPath(tool.slug)}
                  className="text-sm text-primary underline underline-offset-2"
                >
                  {tool.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}