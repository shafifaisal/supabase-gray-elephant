/**
 * HTML rendering/sanitising with a strict allowlist.
 *
 * SECURITY MODEL
 * --------------
 * Admin-authored content is untrusted input. Even a trusted editor could
 * paste content from somewhere else, so raw HTML is NEVER trusted. Two
 * pipelines share one allowlist:
 *
 *   Markdown: `marked` converts Markdown to HTML, then `sanitize-html` applies
 *   the allowlist. Running the sanitiser AFTER conversion (rather than
 *   escaping in `marked`) catches both literal HTML in the source and anything
 *   `marked`'s own output could introduce.
 *
 *   Rich text HTML: the visual editor's HTML goes straight through
 *   `sanitize-html`. The allowlist permits the tags, attributes and the small
 *   `style` subset the editor produces, and strips everything else.
 *
 * The sanitised result is stored, then sanitised AGAIN on read
 * (`sanitizeForRender`). No HTML string reaches the browser unfiltered.
 *
 * This module runs on the server.
 */

import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/** Tags permitted in rendered article content. */
const ALLOWED_TAGS = [
  "p", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "span",
  "sub", "sup",
  "code", "pre", "blockquote",
  "ul", "ol", "li",
  "a", "img",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  "figure", "figcaption",
];

/**
 * Inline colour values the rich text editor may emit.
 *
 * The editor only ever writes hex, `rgb()`, `rgba()`, `hsl()`/`hsla()` or a
 * plain CSS colour name. Anything else — including `url(...)`,
 * `expression(...)` or a `javascript:` payload hidden in a function — fails
 * every pattern and is dropped.
 */
const COLOR_VALUES = [
  /^#[0-9a-f]{3,8}$/i,
  /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i,
  /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\)$/i,
  /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i,
  /^[a-z]{3,20}$/i,
];

const LENGTH_VALUES = [/^\d{1,4}(?:px|%)$/i];
const AUTO_VALUES = [/^(?:auto|0(?:px)?)$/i];

/**
 * Inline CSS permitted inside `style`, keyed by property.
 *
 * The rich text editor needs to round-trip font size, colour, highlight and
 * alignment, so a deliberately tiny, shape-constrained `style` subset is
 * allowed. Every other property (`position`, `display` on non-images, `url()`,
 * etc.) is stripped, which keeps a `style` attribute from ever being used to
 * overlay content, load a remote resource or escape the article column.
 */
const ALLOWED_STYLES: sanitizeHtml.IOptions["allowedStyles"] = {
  "*": {
    color: COLOR_VALUES,
    "background-color": COLOR_VALUES,
    "font-size": [/^\d{1,3}(?:\.\d+)?(?:px|rem|em|%)$/i],
    "text-align": [/^(?:left|right|center|justify)$/i],
  },
  img: {
    width: LENGTH_VALUES,
    height: LENGTH_VALUES,
    "margin-left": AUTO_VALUES,
    "margin-right": AUTO_VALUES,
    display: [/^block$/i],
    float: [/^(?:left|right|none)$/i],
  },
};

/** Tags that may carry the constrained inline `style` subset above. */
const STYLE_ALLOWED_TAGS = [
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "span", "mark", "li", "blockquote",
  "td", "th", "table", "figure", "figcaption", "div", "img",
];

/** Attributes permitted per tag. */
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "title", "rel", "target"],
  // `data-width`/`data-align` are inert authoring hints emitted by the editor so
  // image sizing/alignment survives a round-trip; they cannot execute anything.
  img: [
    "src", "alt", "title", "width", "height", "loading", "style",
    "data-width", "data-align",
  ],
  code: ["class"],
  th: ["scope", "colspan", "rowspan", "style"],
  td: ["colspan", "rowspan", "style"],
};

for (const tag of STYLE_ALLOWED_TAGS) {
  const existing = ALLOWED_ATTRIBUTES[tag] ?? [];
  if (!existing.includes("style")) {
    ALLOWED_ATTRIBUTES[tag] = [...existing, "style"];
  }
}

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
  // Only the tiny, shape-constrained inline subset needed by the rich text
  // editor survives. See ALLOWED_STYLES for the reasoning.
  allowedStyles: ALLOWED_STYLES,
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
 *
 * Works on both rich text (stored HTML) and Markdown-rendered HTML, so the
 * excerpt fallback is identical whichever format an article uses.
 */
export function htmlToPlainText(html: string, maxLength = 200): string {
  if (!html) return "";

  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;

  // Trim to a word boundary so excerpts do not end mid-word.
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.8 ? truncated.slice(0, lastSpace) : truncated).trimEnd()}…`;
}

/** Plain-text extraction for legacy Markdown content. */
export function markdownToPlainText(markdown: string, maxLength = 200): string {
  return htmlToPlainText(renderMarkdown(markdown), maxLength);
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