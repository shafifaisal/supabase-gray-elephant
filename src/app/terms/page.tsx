import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/layout/legal-page";
import { getContactEmail, getLegalHtml } from "@/lib/settings/public";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The terms that apply when you use iPassGenerator, including the important limits of the password strength and entropy estimates.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "2026-01-15";

export default async function TermsPage() {
  const [cmsHtml, contactEmail] = await Promise.all([
    getLegalHtml("legal_terms_html"),
    getContactEmail(),
  ]);

  return (
    <LegalPage title="Terms of Use" updated={UPDATED} cmsHtml={cmsHtml}>
      <p>
        These terms apply when you use {siteConfig.name}. By using the site you
        agree to them. They are written to be read, not to bury anything.
      </p>

      <LegalSection id="what-this-is">What this site is</LegalSection>
      <p>
        {siteConfig.name} provides free, browser-based tools for generating
        passwords, passphrases and random strings, and for estimating password
        strength and entropy. The tools are provided for your personal and
        professional use.
      </p>

      <LegalSection id="estimates">Strength and entropy figures are estimates</LegalSection>
      <p>
        The strength score, crack-time estimate and entropy figure shown by the
        tools are <strong>approximations</strong>, not guarantees. They model how
        an attacker might behave using published techniques; a determined
        attacker with more resources, a data breach containing your other
        passwords, or knowledge of your habits may do better than the estimate
        suggests. Treat the numbers as guidance, never as a promise that a
        password is unbreakable.
      </p>

      <LegalSection id="your-responsibility">You are responsible for your secrets</LegalSection>
      <p>
        Because generation happens on your device, you are the only person who
        ever holds the generated value. If you lose it, we cannot recover it —
        we never had it. Keep your passwords safe, use a reputable password
        manager, and enable multi-factor authentication wherever it is offered.
      </p>

      <LegalSection id="acceptable-use">Acceptable use</LegalSection>
      <p>You agree not to:</p>
      <ul>
        <li>use the site to break any applicable law;</li>
        <li>
          attempt to disrupt, overload or gain unauthorised access to the site
          or its infrastructure;
        </li>
        <li>
          misuse the contact form, including sending spam or automated abuse.
        </li>
      </ul>

      <LegalSection id="no-warranty">No warranty</LegalSection>
      <p>
        The site is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;,
        without warranties of any kind. To the extent permitted by law, we are
        not liable for any loss or damage arising from your use of the site,
        including any compromise of an account secured by a password you
        generated or assessed here.
      </p>

      <LegalSection id="content">Content and originality</LegalSection>
      <p>
        The written articles and explanations on this site are original work. The
        passphrase generator uses the EFF large word list, used under its stated
        licence, and the strength checker uses the open-source zxcvbn algorithm
        through a maintained port. See the{" "}
        <Link href="/about">about page</Link> for full attribution.
      </p>

      <LegalSection id="changes">Changes and availability</LegalSection>
      <p>
        We may update these terms or change the site at any time. The
        &ldquo;last updated&rdquo; date reflects the most recent revision. We
        aim to keep the tools available but do not guarantee uninterrupted
        access.
      </p>

      <LegalSection id="contact">Contact</LegalSection>
      <p>
        Questions about these terms? Email{" "}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a> or use the{" "}
        <Link href="/contact">contact form</Link>.
      </p>
    </LegalPage>
  );
}
