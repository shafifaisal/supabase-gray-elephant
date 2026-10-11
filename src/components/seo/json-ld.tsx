import { serializeJsonLd } from "@/lib/seo/structured-data";

/**
 * Renders a JSON-LD <script> tag.
 *
 * Centralising this keeps the escaping rule in one place: the payload is always
 * passed through `serializeJsonLd`, so no caller can accidentally emit an
 * unescaped `<` that would let structured data become an XSS vector.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // serializeJsonLd escapes < > & as unicode escapes, so the resulting
      // string is safe as element text and cannot close the script tag.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
