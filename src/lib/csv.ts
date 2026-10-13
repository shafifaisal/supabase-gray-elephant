/**
 * Minimal RFC 4180 CSV serialisation.
 *
 * Kept dependency-free: the admin inbox only needs to hand a handful of rows to
 * a spreadsheet. A field is quoted when it contains a comma, quote, CR or LF;
 * embedded quotes are doubled. Rows are joined with CRLF so the output opens
 * cleanly in Excel and other spreadsheet tools.
 */
export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  const lines = [
    headers.map(escapeCsvField).join(","),
    ...rows.map((row) => row.map(escapeCsvField).join(",")),
  ];

  return lines.join("\r\n");
}

function escapeCsvField(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}
