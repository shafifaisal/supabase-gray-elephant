import type { Metadata } from "next";

import { PassphraseGeneratorTool } from "@/components/tools/passphrase-generator";
import { PrivacyNotice } from "@/components/ui/primitives";
import { absoluteUrl } from "@/lib/site";
import { getTool } from "@/lib/tools";
import { WORDLIST_ATTRIBUTION, WORDLIST_LICENSE_URL } from "@/lib/crypto/wordlist";

const tool = getTool("passphrase-generator")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  keywords: [...tool.keywords],
  alternates: { canonical: "/passphrase-generator" },
  openGraph: {
    title: `${tool.name} — runs in your browser`,
    description: tool.description,
    url: absoluteUrl("/passphrase-generator"),
    type: "website",
  },
};

export default function PassphraseGeneratorPage() {
  return (
    <div className="container-page py-10">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {tool.name}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{tool.description}</p>
      </div>

      <div className="mt-6 max-w-3xl">
        <PrivacyNotice />
      </div>

      <div className="mt-8 max-w-3xl">
        <PassphraseGeneratorTool />
      </div>

      <div className="mt-12 max-w-3xl rounded-[var(--radius-card)] border border-border bg-secondary/40 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Entropy, honestly explained
        </h2>
        <div className="mt-3 space-y-3 text-sm text-muted-foreground">
          <p>
            The bundled word list contains 7,776 entries. Because 7,776 is
            exactly 6⁵, a uniformly random word carries exactly log₂(7776) ≈
            12.92 bits. Six words therefore represent about 77.5 bits.
          </p>
          <p>
            That figure is an <strong className="text-foreground">upper
            bound</strong>. It holds only if the words really were chosen at
            random. It does not account for a passphrase you invented yourself,
            one built from words others would guess, or one you have reused
            across several services.
          </p>
          <p>
            Passphrases trade a little strength for something you can actually
            recall correctly. That is a worthwhile trade, but reuse remains the
            single biggest cause of account compromise — pair any passphrase
            with a password manager and a second factor.
          </p>
          <p className="text-xs">
            Word list: {WORDLIST_ATTRIBUTION}.{" "}
            <a
              href={WORDLIST_LICENSE_URL}
              rel="license noopener noreferrer"
              target="_blank"
              className="underline underline-offset-2"
            >
              Licence terms
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}