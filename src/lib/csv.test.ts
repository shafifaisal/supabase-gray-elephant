import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

describe("toCsv", () => {
  it("joins headers and rows with CRLF", () => {
    expect(toCsv(["a", "b"], [["1", "2"]])).toBe("a,b\r\n1,2");
  });

  it("quotes fields containing separators and doubles embedded quotes", () => {
    expect(toCsv(["x"], [["a,b"], ['say "hi"'], ["line1\nline2"]])).toBe(
      'x\r\n"a,b"\r\n"say ""hi"""\r\n"line1\nline2"',
    );
  });

  it("renders null and undefined as empty fields", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe("a,b\r\n,");
  });

  it("leaves plain values unquoted", () => {
    expect(toCsv(["name"], [["hello world"]])).toBe("name\r\nhello world");
  });

  it("accepts numbers without quoting", () => {
    expect(toCsv(["n"], [[42]])).toBe("n\r\n42");
  });
});
