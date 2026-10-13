import type { Metadata } from "next";

import { ContactForm } from "@/components/contact-form";

import { contactAction } from "./actions";

export const metadata: Metadata = {
  title: "Contact Us.",
  description:
    "Get in touch about iPassGenerator — corrections, bug reports, security issues or feedback.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  return (
    <div className="container-page flex min-h-full flex-col justify-center py-10">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Contact Us.
        </h1>

        <div className="mt-8 rounded-[var(--radius-card)] border border-border bg-background p-6">
          <ContactForm action={contactAction} />
        </div>
      </div>
    </div>
  );
}