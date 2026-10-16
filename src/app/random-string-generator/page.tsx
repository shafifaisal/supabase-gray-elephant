import type { Metadata } from "next";

import { RandomStringGeneratorTool } from "@/components/tools/random-string-generator";
import { PrivacyNotice } from "@/components/ui/primitives";
import { absoluteUrl } from "@/lib/site";
import { getTool } from "@/lib/tools";

const tool = getTool("random-string-generator")!;

const pageTitle = "Free Random String Generator – Tokens, Keys & IDs";
const pageDescription =
  "Create secure random strings for API keys, tokens, salts and identifiers. Pick the length and character sets. Generated in your browser, never sent to a server.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  keywords: [...tool.keywords],
  alternates: { canonical: "/random-string-generator" },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: absoluteUrl("/random-string-generator"),
    type: "website",
  },
};

export default function RandomStringGeneratorPage() {
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
        <RandomStringGeneratorTool />
      </div>

      <div className="mt-12 max-w-3xl rounded-[var(--radius-card)] border border-border bg-secondary/40 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Choosing a length
        </h2>
        <div className="mt-3 space-y-3 text-sm text-muted-foreground">
          <p>
            Unlike a password, a machine-generated secret is usually stored
            hashed or compared byte-for-byte, so you can make it long without
            memorising it.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Session tokens:</strong>{" "}
              128 bits or more (32 hex characters).
            </li>
            <li>
              <strong className="text-foreground">API keys:</strong> 192–256
              bits is a reasonable default.
            </li>
            <li>
              <strong className="text-foreground">Database salts:</strong>{" "}
              128 bits is the conventional minimum.
            </li>
            <li>
              <strong className="text-foreground">CSRF tokens:</strong> 128
              bits; they are short-lived, but there is no reason to be cheap.
            </li>
          </ul>
          <p>
            <strong className="text-foreground">
              Values are never stored or transmitted.
            </strong>{" "}
            Copy the value into the application that needs it, then clear your
            clipboard history if the environment is shared.
          </p>
        </div>
      </div>
    </div>
  );
}