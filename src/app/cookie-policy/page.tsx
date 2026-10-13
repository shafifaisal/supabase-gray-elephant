import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/layout/legal-page";
import { getContactEmail, getLegalHtml } from "@/lib/settings/public";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "Exactly which cookies iPassGenerator sets and why. We use only what is needed to run the site — no analytics or advertising cookies unless you accept optional cookies.",
  alternates: { canonical: "/cookie-policy" },
};

const UPDATED = "2026-10-13";

export default async function CookiePolicyPage() {
  const [cmsHtml, contactEmail] = await Promise.all([
    getLegalHtml("legal_cookie_policy_html"),
    getContactEmail(),
  ]);

  return (
    <LegalPage title="Cookie Policy" updated={UPDATED} cmsHtml={cmsHtml}>
      <p>
        This page lists every cookie {siteConfig.name} sets and why. We keep it
        deliberately short because we use as few cookies as possible.
      </p>

      <LegalSection id="essential">Essential cookies</LegalSection>
      <p>
        These are required for the site to function and cannot be switched off
        in our systems. They are usually set only in response to actions you
        take, such as signing in to the administration panel.
      </p>
      <ul>
        <li>
          <strong>Authentication.</strong> When an administrator signs in,
          Supabase Auth sets secure, HTTP-only session cookies so the server can
          recognise the signed-in user. These do not apply to ordinary visitors
          and never contain a generated password.
        </li>
        <li>
          <strong>Security.</strong> Cookies that help protect against cross-site
          request forgery and help keep the site secure.
        </li>
      </ul>

      <LegalSection id="preferences">Preference cookies</LegalSection>
      <p>
        If we offer a choice such as cookie preferences, we store that single
        choice so we can respect it on your next visit. It records your decision,
        never anything about the passwords you generate.
      </p>

      <LegalSection id="analytics-ads">Analytics and advertising cookies</LegalSection>
      <p>
        We use <strong>Google Analytics 4</strong> to understand which pages are
        useful. It runs only when an administrator has enabled it and you have
        accepted optional cookies. Until you consent, no analytics script loads
        and no analytics cookie is set. When it is active, Google Analytics sets
        first-party cookies — <code>_ga</code>, which distinguishes visitors, and{" "}
        <code>_ga_&lt;id&gt;</code>, which keeps session state — so we can see
        aggregated, anonymous usage. We never send the passwords, passphrases or
        random strings you generate or check: those values never leave your
        device.
      </p>
      <p>
        For advertising, we use Google AdSense only when an administrator has
        enabled it and you have accepted optional cookies. When ads are active,
        Google may set cookies to serve and measure ads; those cookies are never
        set before you consent through the cookie banner. If ads are switched
        off, no advertising cookie is set at all. This page names each cookie
        before it is used.
      </p>

      <LegalSection id="what-we-never-store">
        What we never store in a cookie
      </LegalSection>
      <p>
        No password, passphrase or random string you generate or check is ever
        written to a cookie, to browser storage, to the page URL, or to our
        database. The tools run entirely on your device.
      </p>

      <LegalSection id="managing">Managing cookies</LegalSection>
      <p>
        You can set your browser to block or alert you about cookies, but parts
        of the site — such as the admin sign-in — will not work if you block
        essential cookies. The tools themselves need no cookies at all.
      </p>

      <LegalSection id="contact">Contact</LegalSection>
      <p>
        Questions about cookies? Email{" "}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a> or use the{" "}
        <Link href="/contact">contact form</Link>. See also our{" "}
        <Link href="/privacy-policy">privacy policy</Link>.
      </p>
    </LegalPage>
  );
}
