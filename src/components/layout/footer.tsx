import Image from "next/image";
import Link from "next/link";

import { logoAlt } from "@/lib/seo/alt-text";
import { getBrandName, getFooterText, getTagline } from "@/lib/settings/public";

/**
 * Resolved once per render so prerendering stays deterministic.
 * The value only needs to change when the calendar year does.
 */
function getCurrentYear(): number {
  return new Date().getUTCFullYear();
}

export async function Footer() {
  const year = getCurrentYear();
  const [brandName, footerText, tagline] = await Promise.all([
    getBrandName(),
    getFooterText(),
    getTagline(),
  ]);

  // The tagline is the opening sentence of the footer blurb; the stored value
  // may or may not already end with a full stop, so normalise it.
  const taglineSentence = tagline.trim().replace(/[.!?]+$/, "");

  const sections = [
    {
      title: "Tools",
      links: [
        { href: "/password-generator", label: "Password Generator" },
        { href: "/passphrase-generator", label: "Passphrase Generator" },
        { href: "/password-strength-checker", label: "Strength Checker" },
        { href: "/password-entropy-calculator", label: "Entropy Calculator" },
        { href: "/random-string-generator", label: "Random String Generator" },
      ],
    },
    {
      title: "Learn",
      links: [
        { href: "/articles", label: "Articles" },
        { href: "/about", label: "About" },
        { href: "/contact", label: "Contact" },
      ],
    },
    {
      title: "Legal",
      links: [
        { href: "/privacy-policy", label: "Privacy Policy" },
        { href: "/terms", label: "Terms of Use" },
        { href: "/cookie-policy", label: "Cookie Policy" },
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t border-border bg-secondary/40">
      <div className="container-page py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 font-bold">
              <Image
                src="/logo.png"
                alt={logoAlt(brandName)}
                width={64}
                height={64}
                className="h-8 w-8 object-contain"
                aria-hidden="true"
              />
              <span className="text-xl">{brandName}</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              {taglineSentence}. Everything runs in your browser — nothing is
              uploaded, stored or logged.
            </p>
          </div>

          {sections.map((section) => (
            <nav key={section.title} aria-labelledby={`footer-${section.title}`}>
              <h2
                id={`footer-${section.title}`}
                className="text-sm font-semibold tracking-wide uppercase"
              >
                {section.title}
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="rounded text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} {brandName}. All rights reserved.
          </p>
          <p>{footerText}</p>
        </div>
      </div>
    </footer>
  );
}