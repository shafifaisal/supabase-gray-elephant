import Image from "next/image";
import Link from "next/link";

import { logoAlt } from "@/lib/seo/alt-text";
import { siteConfig } from "@/lib/site";

export interface NavItem {
  href: string;
  label: string;
}

export const primaryNav: NavItem[] = [
  { href: "/tools", label: "Tools" },
  { href: "/articles", label: "Articles" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export const footerNav: NavItem[] = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Use" },
  { href: "/cookie-policy", label: "Cookie Policy" },
];

export function BrandMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Wordmark({ brandName }: { brandName?: string }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-md font-bold tracking-tight text-foreground transition-colors hover:text-primary"
    >
      <Image
        src="/logo.png"
        alt={logoAlt(brandName)}
        width={64}
        height={64}
        priority
        className="h-8 w-8 object-contain"
        aria-hidden="true"
      />
      <span>{brandName ?? siteConfig.name}</span>
    </Link>
  );
}