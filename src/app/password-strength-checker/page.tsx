import type { Metadata } from "next";

import { PasswordStrengthCheckerTool } from "@/components/tools/password-strength-checker";
import { getTool } from "@/lib/tools";

const tool = getTool("password-strength-checker")!;

const pageTitle = "Password Strength Checker – Check Any Password Safely";
const pageDescription =
  "See how strong a password is: length, repetition, sequences and common words. The check runs entirely in your browser, so the password is never sent or stored.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  keywords: [...tool.keywords],
  alternates: { canonical: "/password-strength-checker" },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/password-strength-checker",
    type: "website",
  },
};

export default function PasswordStrengthCheckerPage() {
  return (
    <div className="container-page py-10">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {tool.name}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{tool.description}</p>
      </div>

      <div className="mt-8 max-w-3xl">
        <PasswordStrengthCheckerTool />
      </div>
    </div>
  );
}