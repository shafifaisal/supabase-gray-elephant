import { siteConfig } from "@/lib/site";

/**
 * Central alt-text builders.
 *
 * RULE: every image in the product takes its `alt` from here, so the wording
 * stays consistent and SEO-meaningful. An image must never ship with a missing
 * or empty `alt` unless it is genuinely decorative (e.g. a background pattern) —
 * and even then the value should be an explicit decision, not an oversight.
 *
 * Search engines read `alt` from the markup regardless of ARIA, so where a
 * visible caption or brand text already names the subject for screen readers,
 * the image keeps a descriptive `alt` for crawlers while `aria-hidden="true"`
 * stops assistive tech from reading the same thing twice.
 */

/** Logo alt text: identifies the brand and its purpose. */
export function logoAlt(brandName: string = siteConfig.name): string {
  return `${brandName} — privacy-first password security tools`;
}

/**
 * Article image alt text.
 *
 * Uses the editor-provided description when present; otherwise falls back to the
 * article title, which is specific and keyword-relevant. Alt text should
 * describe the image, not repeat a keyword list.
 */
export function articleImageAlt(params: {
  title: string;
  alt?: string | null;
}): string {
  const provided = params.alt?.trim();
  return provided && provided.length > 0 ? provided : params.title;
}
