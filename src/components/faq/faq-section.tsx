import { FaqAccordion } from "@/components/faq/faq-accordion";
import { faqItems } from "@/lib/content/faq";

/**
 * Homepage FAQ section. Rendered as a server component so the questions and
 * answers ship in the initial HTML; only the accordion behaviour is client-side.
 */
export function FaqSection() {
  return (
    <section
      aria-labelledby="faq-heading"
      className="container-page border-t border-border py-16"
    >
      <div className="mx-auto max-w-3xl">
        <h2
          id="faq-heading"
          className="text-center text-2xl font-bold tracking-tight sm:text-3xl"
        >
          Frequently Asked Questions
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-base text-muted-foreground">
          Straight answers to common questions about password generation,
          password security, entropy, and how to stay safe online — from how to
          create a strong password to whether a generated value ever leaves your
          device.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-3xl">
        <FaqAccordion items={faqItems} />
      </div>
    </section>
  );
}