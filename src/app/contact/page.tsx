import type { Metadata } from "next";

import { ContactForm } from "@/components/contact-form";

import { contactAction } from "./actions";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch about iPassGenerator — corrections, bug reports, security issues or feedback.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  return (
    <div className="container-page flex min-h-full flex-col justify-center py-10">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Contact
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Found an error in a guide, or a security issue to report? Please tell
          us.
        </p>

        <div className="mt-8 rounded-[var(--radius-card)] border border-border bg-background p-6">
          <ContactForm action={contactAction} />
        </div>
      </div>
    </div>
  );
}