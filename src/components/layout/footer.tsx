import Link from "next/link";

import { BrandMark } from "@/components/layout/nav-links";

/**
 * Resolved once at build time (and cached) so prerendering stays deterministic.
 * The value only needs to change when the calendar year does.
 */
async function getCurrentYear(): Promise<number> {
  "use cache";
  return new Date().getUTCFullYear();
}

export async function Footer() {
  const year = await getCurrentYear();

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
        { href: "/guides", label: "Guides" },
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
              <BrandMark className="h-6 w-6 text-primary" />
              <span>iPassGenerator</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Privacy-first password security tools. Everything runs in your
              browser — nothing is uploaded, stored or logged.
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
          <p>&copy; {year} iPassGenerator. All rights reserved.</p>
          <p>Generated secrets never leave your device.</p>
        </div>
      </div>
    </footer>
  );
}