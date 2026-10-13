import { describe, expect, it } from "vitest";

import { buildXlsx } from "./xlsx";

/** Stored ZIP entries keep their bytes verbatim, so the XML is searchable. */
function asText(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

describe("buildXlsx", () => {
  const file = buildXlsx("Messages", [
    ["Name", "Email"],
    ["Faisal Shafi", "shafi.akhai@gmail.com"],
  ]);

  it("starts with the ZIP local-file-header signature", () => {
    expect([file[0], file[1], file[2], file[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("ends with the ZIP end-of-central-directory signature", () => {
    const tail = buildXlsx("Messages", [["x"]]).slice(-22);
    expect([tail[0], tail[1], tail[2], tail[3]]).toEqual([
      0x50, 0x4b, 0x05, 0x06,
    ]);
  });

  it("contains the required OOXML parts", () => {
    const text = asText(file);
    expect(text).toContain("[Content_Types].xml");
    expect(text).toContain("xl/workbook.xml");
    expect(text).toContain("xl/worksheets/sheet1.xml");
    expect(text).toContain('<sheet name="Messages"');
  });

  it("stores cell values as inline strings with a header row", () => {
    const text = asText(file);
    expect(text).toContain('<c r="A1" t="inlineStr"><is><t xml:space="preserve">Name</t></is></c>');
    expect(text).toContain("Faisal Shafi");
    expect(text).toContain("shafi.akhai@gmail.com");
  });

  it("escapes XML-special characters", () => {
    const text = asText(buildXlsx("Messages", [["a & b <c>"]]));
    expect(text).toContain("a &amp; b &lt;c&gt;");
  });

  it("writes numbers as numeric cells", () => {
    const text = asText(buildXlsx("Messages", [[42]]));
    expect(text).toContain('<c r="A1"><v>42</v></c>');
  });

  it("maps column indexes to spreadsheet letters", () => {
    const wide = buildXlsx("Messages", [new Array(28).fill("x")]);
    const text = asText(wide);
    expect(text).toContain('r="AB1"');
  });
});
