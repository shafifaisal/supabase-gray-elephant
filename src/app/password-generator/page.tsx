import type { Metadata } from "next";

import { PasswordGeneratorTool } from "@/components/tools/password-generator";
import { PrivacyNotice } from "@/components/ui/primitives";
import { absoluteUrl } from "@/lib/site";
import { getTool } from "@/lib/tools";

const tool = getTool("password-generator")!;

/**
 * Rendered through the root layout's `%s | <brand>` title template, so the
 * brand suffix stays in sync with the admin-editable site name instead of
 * being hard-coded here.
 */
const pageTitle = "Free Password Generator – Create Strong, Random Passwords";
const pageDescription =
  "Generate strong, random passwords online for free. Customize password length and choose uppercase letters, lowercase letters, numbers, and symbols. Create secure passwords in seconds.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  keywords: [...tool.keywords],
  alternates: { canonical: "/password-generator" },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: absoluteUrl("/password-generator"),
    type: "website",
  },
};

export default function PasswordGeneratorPage() {
  return (
    <div className="container-page py-10">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Free Online Password Generator
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{tool.description}</p>
      </div>

      <div className="mt-6 max-w-3xl">
        <PrivacyNotice />
      </div>

      <div className="mt-8 max-w-3xl">
        <PasswordGeneratorTool />
      </div>

      <div className="mt-12 max-w-3xl rounded-[var(--radius-card)] border border-border bg-secondary/40 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          How this works
        </h2>
        <div className="mt-3 space-y-3 text-sm text-muted-foreground">
          <p>
            Every character is drawn from the browser&rsquo;s cryptographic
            random number generator via{" "}
            <code>crypto.getRandomValues()</code>. Values are drawn using
            rejection sampling, which discards any out-of-range result rather
            than folding it with a modulo — the step that most naive
            implementations skip, and the one that leaves the first characters
            in a pool marginally more likely than the last.
          </p>
          <p>
            At least one character from each group you enable is placed first,
            then the whole string is shuffled with a CSPRNG-driven Fisher–Yates
            pass, so those characters do not sit in predictable positions.
          </p>
          <p>
            <strong className="text-foreground">
              The result never leaves your device.
            </strong>{" "}
            It is not sent to a server, saved to storage, placed in a URL, or
            written to a log. Refreshing the page discards it.
          </p>
        </div>
      </div>
    </div>
  );
}