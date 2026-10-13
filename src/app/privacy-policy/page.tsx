import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/layout/legal-page";
import { getContactEmail, getLegalHtml } from "@/lib/settings/public";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What iPassGenerator does and does not collect. The security tools run entirely in your browser and never transmit, store or log what you generate.",
  alternates: { canonical: "/privacy-policy" },
};

/** Single source of the "last reviewed" date for this policy. */
const UPDATED = "2026-10-13";

export default async function PrivacyPolicyPage() {
  const [cmsHtml, contactEmail] = await Promise.all([
    getLegalHtml("legal_privacy_policy_html"),
    getContactEmail(),
  ]);

  return (
    <LegalPage title="Privacy Policy" updated={UPDATED} cmsHtml={cmsHtml}>
      <p>
        This policy explains what {siteConfig.name} collects when you use this
        website, and — just as importantly — what it does not. The short version:
        the password tools on this site do the work on your own device, and
        nothing you generate is sent to us.
      </p>

      <LegalSection id="tools">The security tools</LegalSection>
      <p>
        Every generator and analyser on this site — the password generator,
        passphrase generator, random string generator, strength checker and
        entropy calculator — runs entirely in your browser using the Web Crypto
        API. When you generate a password or check a strength, the value is
        created and processed in your device&rsquo;s memory.
      </p>
      <p>Specifically, for the tools we do not:</p>
      <ul>
        <li>send what you type or generate to any server;</li>
        <li>store it in a database, cookie, or browser storage;</li>
        <li>include it in any analytics event, error report or log.</li>
      </ul>
      <p>
        You can verify this yourself. Open your browser&rsquo;s developer tools,
        watch the Network tab while using a tool, and you will see no request
        carrying your input. Check the Storage panel and you will find nothing
        written. There is intentionally no database table for generated or
        checked passwords.
      </p>

      <LegalSection id="what-we-collect">What we do collect</LegalSection>
      <p>
        Like almost every website, some data is processed simply to serve pages
        and keep the site secure:
      </p>
      <ul>
        <li>
          <strong>Hosting logs.</strong> Our hosting provider may record standard
          request information such as IP address, browser type and the page
          requested, for security and reliability. These logs are not linked to
          anything you generate.
        </li>
        <li>
          <strong>Contact form.</strong> If you choose to email us through the
          contact form, we store the name, email address, subject and message
          you provide so we can reply. Messages are deleted once the
          conversation is finished. Please never include a real password in a
          message.
        </li>
      </ul>

      <LegalSection id="analytics-ads">Analytics and advertising</LegalSection>
      <p>
        We use <strong>Google Analytics 4</strong> to understand how the site is
        used, and only when an administrator has enabled it and you have accepted
        optional cookies. No analytics script loads{" "}
        <strong>until you consent</strong> through the cookie banner. Google
        Analytics records aggregated page-view information (such as the page
        visited, an approximate location derived from IP, and browser type) and
        sets first-party <code>_ga</code> cookies for that purpose; Google acts
        as a processor for this data under its own terms. We never send the
        passwords, passphrases or random strings you generate or check — those
        stay on your device and are excluded from every analytics event by
        design.
      </p>
      <p>
        For advertising we use Google AdSense, and only when an administrator has
        enabled it and you have accepted optional cookies. No advertising script
        loads <strong>until you consent</strong> through the cookie banner; if ads
        are switched off, nothing is loaded at all. When ads are active, Google
        acts as a separate controller for the data involved in serving ads, as
        described in Google&rsquo;s own policies. This policy is kept accurate to
        match whatever is actually enabled — we will never claim to collect
        nothing while an analytics or advertising service is running.
      </p>

      <LegalSection id="cookies">Cookies</LegalSection>
      <p>
        We use cookies only where they are needed to make the site work — for
        example, to keep a signed-in administrator&rsquo;s session active. We do
        not use cookies to track you across other websites. See the{" "}
        <Link href="/cookie-policy">cookie policy</Link> for the detail.
      </p>

      <LegalSection id="sharing">Sharing and selling</LegalSection>
      <p>
        We do not sell, rent or broker your personal information. We do not
        share it with third parties except the service providers that host and
        operate this site, and only as needed to run it.
      </p>

      <LegalSection id="your-rights">Your choices and rights</LegalSection>
      <p>
        You can use every tool without an account and without identifying
        yourself. If you have contacted us and want your message deleted, email{" "}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a> and we will remove
        it. Depending on where you live, you may also have rights to access,
        correct or erase personal data we hold about you; we will honour those
        requests.
      </p>

      <LegalSection id="changes">Changes to this policy</LegalSection>
      <p>
        If this policy changes, the &ldquo;last updated&rdquo; date above changes
        with it. Material changes will be reflected here before they take effect.
      </p>

      <LegalSection id="contact">Contact</LegalSection>
      <p>
        Questions about privacy? Email{" "}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a> or use the{" "}
        <Link href="/contact">contact form</Link>.
      </p>
    </LegalPage>
  );
}
