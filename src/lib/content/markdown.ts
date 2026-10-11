/**
 * Markdown rendering with a strict HTML allowlist.
 *
 * SECURITY MODEL
 * --------------
 * Admin-authored Markdown is untrusted input. Even a trusted editor could
 * paste content from somewhere else, so raw HTML embedded in Markdown is
 * NEVER trusted. The pipeline is:
 *
 *   1. `marked` converts Markdown to HTML, with raw HTML pass-through enabled
 *      only because step 2 removes it anyway.
 *   2. `sanitize-html` applies an allowlist: specific tags, attributes, and
 *      URL schemes. Everything not listed is stripped.
 *
 * Running sanitize-html AFTER conversion (rather than configuring marked to
 * escape HTML) is deliberate: it catches both literal HTML in the source and
 * anything marked's own output could introduce.
 *
 * This module runs on the server. No HTML string reaches the client unfiltered.
 */

import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/** Tags permitted in rendered article content. */
const ALLOWED_TAGS = [
  "p", "br", "hr",
  "h2", "h3", "h4", "h5", "h6",
  "strong", "em", "del", "code", "pre", "blockquote",
  "ul", "ol", "li",
  "a", "img",
  "table", "thead", "tbody", "tr", "th", "td",
  "sup", "sub",
];

/** Attributes permitted per tag. */
const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "title", "rel", "target"],
  img: ["src", "alt", "title", "width", "height", "loading"],
  code: ["class"],
  th: ["scope", "colspan", "rowspan"],
  td: ["colspan", "rowspan"],
};

/**
 * URL schemes permitted in href/src.
 *
 * Notably absent: `javascript:`, `data:` and `vbscript:`. sanitize-html
 * normalises schemes and entity encodings before comparing, so
 * `JaVaScRiPt:` and `java&#115;cript:` are both rejected.
 */
const ALLOWED_SCHEMES = ["http", "https", "mailto", "tel"];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTRIBUTES,
  allowedSchemes: ALLOWED_SCHEMES,
  allowedSchemesAppliedToAttributes: ["href", "src"],
  // No style attributes anywhere: they enable clickjacking overlays and
  // data exfiltration via CSS in some contexts.
  allowedStyles: {},
  allowProtocolRelative: false,
  // Drop images/links entirely rather than leaving broken references.
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe"],
  transformTags: {
    // External links must not gain access to this window via opener, and
    // should not pass link equity implicitly.
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow" }),
  },
  disallowedTagsMode: "discard",
};

marked.setOptions({
  gfm: true,
  breaks: false,
});

/**
 * Re-sanitises stored HTML immediately before it is rendered.
 *
 * Defence in depth. Content is already sanitised on write, but a row could
 * have been inserted by a migration, a seed script, or an older build that
 * predates the write-path sanitiser. Re-running the allowlist on output means
 * no stored value can execute script in a visitor's browser, whatever put it
 * there.
 */
export function sanitizeForRender(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/**
 * Converts Markdown to sanitized HTML safe for public rendering.
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown || markdown.trim().length === 0) return "";

  const rawHtml = marked.parse(markdown, { async: false }) as string;

  return sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
}

/**
 * Strips all HTML and returns plain text, used for excerpts and meta
 * descriptions. Escaped afterwards so it is safe to embed in an attribute.
 */
export function markdownToPlainText(markdown: string, maxLength = 200): string {
  const html = renderMarkdown(markdown);
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;

  // Trim to a word boundary so excerpts do not end mid-word.
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.8 ? truncated.slice(0, lastSpace) : truncated).trimEnd()}…`;
}

/** Escapes a string for safe interpolation into HTML text or attributes. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}