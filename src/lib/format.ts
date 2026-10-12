/** Small, locale-stable formatting helpers used across server components. */

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatDateTime(date: Date): string {
  return `${dateTimeFormatter.format(date)} UTC`;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

/** Converts a title into a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    // Treat underscores as word separators before stripping other punctuation,
    // otherwise "b__c" would collapse to "bc".
    .replace(/_/g, " ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Words dropped from auto-generated slugs. Connectors, articles and common
 * filler words add no value to a URL and only make slugs longer. Word matching
 * is by whole token, so "candy" (contains "and") is never affected.
 */
export const SLUG_STOP_WORDS = new Set([
  "a", "an", "the",
  "and", "or", "but", "nor", "so", "yet",
  "of", "to", "in", "on", "at", "for", "with", "by", "from", "as", "into",
  "is", "are", "was", "were", "be", "been", "being", "am",
  "this", "that", "these", "those",
  "it", "its",
  "your", "you",
]);

/**
 * Builds a slug for auto-generation from a title: a normalised {@link slugify}
 * with stop words removed. Falls back to the plain slug if every token is a
 * stop word, so a title is never reduced to an empty slug by filtering alone.
 */
export function slugifyTitle(input: string): string {
  const slug = slugify(input);
  const filtered = slug
    .split("-")
    .filter((token) => token && !SLUG_STOP_WORDS.has(token))
    .join("-");

  return filtered || slug;
}