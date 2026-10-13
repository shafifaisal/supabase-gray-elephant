import type { Metadata } from "next";

import { ContactForm } from "@/components/contact-form";
import { getContactEmail } from "@/lib/settings/public";
import { siteConfig } from "@/lib/site";

import { contactAction } from "./actions";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch about iPassGenerator — corrections, bug reports, security issues or feedback.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const contactEmail = await getContactEmail();

  return (
    <div className="container-page py-10">
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

        <p className="mt-4 text-sm text-muted-foreground">
          Prefer email? Write to{" "}
          <a
            href={`mailto:${contactEmail}`}
            className="font-medium text-foreground underline underline-offset-2"
          >
            {contactEmail}
          </a>
          .
        </p>

        <div className="mt-8 rounded-[var(--radius-card)] border border-border bg-secondary/40 p-5">
          <h2 className="text-sm font-semibold">Reporting a security issue</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            If you believe you have found a vulnerability, email{" "}
            <a
              href={`mailto:security@${siteConfig.url.replace(/^https?:\/\//, "")}`}
              className="underline underline-offset-2"
            >
              security@{siteConfig.url.replace(/^https?:\/\//, "")}
            </a>{" "}
            with steps to reproduce. We will acknowledge reports and aim to fix
            confirmed issues promptly.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            <strong className="text-foreground">
              Please do not paste real passwords
            </strong>{" "}
            into any message. We could not help you even if we wanted to, and
            it is safer not to send them at all.
          </p>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Messages are stored so we can reply, and are deleted once the
          conversation is finished.
        </p>
      </div>
    </div>
  );
}