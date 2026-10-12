import { describe, expect, it } from "vitest";

import {
  escapeHtml,
  htmlToPlainText,
  markdownToPlainText,
  renderMarkdown,
  sanitizeForRender,
} from "@/lib/content/markdown";

/**
 * These tests are the security boundary for admin-authored content. A failure
 * here means user-supplied HTML could execute in a visitor's browser.
 */
describe("renderMarkdown — dangerous input", () => {
  it("strips script tags and their contents", () => {
    const html = renderMarkdown("Hello <script>alert('xss')</script> world");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(");
    expect(html).toContain("Hello");
  });

  it("strips event handler attributes", () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("alert(1)");
  });

  it("strips javascript: URLs", () => {
    const html = renderMarkdown("[click me](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("strips obfuscated javascript: URLs", () => {
    const payloads = [
      "[a](JaVaScRiPt:alert(1))",
      "[a](java&#115;cript:alert(1))",
      "[a]( javascript:alert(1))",
      "[a](jAvAsCrIpT&#58;alert(1))",
    ];

    for (const payload of payloads) {
      const html = renderMarkdown(payload);
      expect(html.toLowerCase()).not.toContain("javascript:");
    }
  });

  it("strips data: URLs", () => {
    const html = renderMarkdown("[a](data:text/html;base64,PHNjcmlwdD4=)");
    expect(html.toLowerCase()).not.toContain("data:text/html");
  });

  it("strips iframes", () => {
    const html = renderMarkdown('<iframe src="https://evil.example"></iframe>');
    expect(html).not.toContain("<iframe");
  });

  it("strips dangerous CSS while keeping permitted properties", () => {
    const html = renderMarkdown('<p style="position:fixed;inset:0;color:red">x</p>');
    expect(html).not.toContain("position");
    expect(html).not.toContain("inset");
    expect(html).toContain("color:red");
  });

  it("rejects CSS url() payloads", () => {
    const html = renderMarkdown(
      '<p style="background-color:url(javascript:alert(1))">x</p>',
    );
    expect(html.toLowerCase()).not.toContain("javascript");
  });

  it("strips <style> blocks", () => {
    const html = renderMarkdown("<style>body{display:none}</style>text");
    expect(html).not.toContain("<style");
  });

  it("strips svg-based vectors", () => {
    const html = renderMarkdown('<svg onload="alert(1)"><circle /></svg>');
    expect(html.toLowerCase()).not.toContain("<svg");
  });

  it("strips form elements", () => {
    const html = renderMarkdown('<form action="https://evil.example"><input></form>');
    expect(html.toLowerCase()).not.toContain("<form");
    expect(html.toLowerCase()).not.toContain("<input");
  });

  it("strips meta refresh redirects", () => {
    const html = renderMarkdown('<meta http-equiv="refresh" content="0;url=https://evil.example">');
    expect(html.toLowerCase()).not.toContain("<meta");
  });
});

describe("renderMarkdown — legitimate content", () => {
  it("renders headings", () => {
    const html = renderMarkdown("## Getting started");
    expect(html).toContain("<h2>Getting started</h2>");
  });

  it("renders paragraphs and emphasis", () => {
    const html = renderMarkdown("This is **bold** and *italic*.");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("renders lists", () => {
    expect(renderMarkdown("- one\n- two")).toContain("<li>one</li>");
    expect(renderMarkdown("1. one\n2. two")).toContain("<ol>");
  });

  it("renders code blocks", () => {
    const html = renderMarkdown("```js\nconst a = 1;\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain("<code");
  });

  it("renders tables", () => {
    const html = renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>");
  });

  it("renders safe links", () => {
    const html = renderMarkdown("[docs](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("allows mailto links", () => {
    const html = renderMarkdown("[mail](mailto:hello@example.com)");
    expect(html).toContain("mailto:hello@example.com");
  });

  it("keeps alt text on images", () => {
    const html = renderMarkdown('![A diagram](https://example.com/a.png)');
    expect(html).toContain('alt="A diagram"');
    expect(html).toContain('src="https://example.com/a.png"');
  });

  it("returns an empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown("   ")).toBe("");
  });

  it("handles realistic long-form content", () => {
    const content = [
      "## Section one",
      "",
      "Intro paragraph with **bold** and a [link](https://example.com).",
      "",
      "### Subsection",
      "",
      "- point one",
      "- point two",
      "",
      "> A quote.",
      "",
      "| Column | Value |",
      "|---|---|",
      "| A | 1 |",
    ].join("\n");

    const html = renderMarkdown(content);
    expect(html).toContain("<h2");
    expect(html).toContain("<h3");
    expect(html).toContain("<ul>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<table>");
  });

  /**
   * The visual editor offers H1–H6, so the body allowlist must keep H1. The
   * article title still renders as the page's primary heading; authors who want
   * a tidy outline can simply begin their body at H2.
   */
  it("keeps an h1 so the editor's Heading 1 renders", () => {
    const html = renderMarkdown("# My Heading");
    expect(html).toContain("<h1>My Heading</h1>");
  });
});

describe("markdownToPlainText", () => {
  it("removes markup", () => {
    expect(markdownToPlainText("# Title\n\nSome **bold** text")).toBe(
      "Title Some bold text",
    );
  });

  it("truncates at a word boundary rather than mid-word", () => {
    const text = markdownToPlainText(
      "one two three four five six seven eight nine ten",
      20,
    );
    expect(text.length).toBeLessThanOrEqual(21);
    expect(text.endsWith("…")).toBe(true);
    // The ellipsis must follow a complete word, not a fragment.
    expect(text).toBe("one two three four…");
  });

  it("keeps a complete word when the cut point is mid-word", () => {
    const text = markdownToPlainText("alpha bravo charlie delta", 13);
    expect(text).toBe("alpha bravo…");
  });

  it("does not truncate when the text fits", () => {
    expect(markdownToPlainText("short text")).toBe("short text");
  });

  it("strips scripts from the extracted text", () => {
    expect(markdownToPlainText("Hello <script>alert(1)</script>")).not.toContain("alert");
  });
});

describe("sanitizeForRender — rich text editor output", () => {
  it("keeps colour, font size and alignment", () => {
    const html = sanitizeForRender(
      '<p style="text-align:center"><span style="color:#ff0000;font-size:24px">Hi</span></p>',
    );
    expect(html).toContain("text-align:center");
    expect(html).toContain("color:#ff0000");
    expect(html).toContain("font-size:24px");
  });

  it("keeps semantic headings h1–h6", () => {
    const html = sanitizeForRender(
      "<h1>1</h1><h2>2</h2><h3>3</h3><h4>4</h4><h5>5</h5><h6>6</h6>",
    );
    for (const tag of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
      expect(html).toContain(`<${tag}>`);
    }
  });

  it("keeps ul, ol, li, blockquote and hr", () => {
    const html = sanitizeForRender(
      "<ul><li>a</li></ul><ol><li>b</li></ol><blockquote>q</blockquote><hr>",
    );
    expect(html).toContain("<ul>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<hr");
  });

  it("keeps tables with header and body cells", () => {
    const html = sanitizeForRender(
      "<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>",
    );
    expect(html).toContain("<table>");
    expect(html).toContain("<th>");
    expect(html).toContain("<td>");
  });

  it("keeps image width and alignment hints", () => {
    const html = sanitizeForRender(
      '<img src="https://x.example/a.png" alt="a" data-width="50%" data-align="center" style="width: 50%; display: block; margin-left: auto; margin-right: auto">',
    );
    expect(html).toContain('data-width="50%"');
    expect(html).toContain('data-align="center"');
    expect(html).toContain("width:50%");
  });

  it("strips javascript: image sources and event handlers", () => {
    const html = sanitizeForRender(
      '<img src="javascript:alert(1)" onerror="alert(2)">',
    );
    expect(html.toLowerCase()).not.toContain("javascript");
    expect(html.toLowerCase()).not.toContain("onerror");
  });

  it("keeps a safe link and forces safe rel/target attributes", () => {
    const html = sanitizeForRender(
      '<a href="https://example.com" target="_blank">x</a>',
    );
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("noopener");
  });

  it("drops scripts entirely", () => {
    const html = sanitizeForRender("<p>ok</p><script>alert(1)</script>");
    expect(html.toLowerCase()).not.toContain("<script");
    expect(html).toContain("ok");
  });
});

describe("htmlToPlainText", () => {
  it("extracts text from rich HTML", () => {
    expect(htmlToPlainText("<p>Hello <strong>world</strong></p>")).toBe(
      "Hello world",
    );
  });

  it("truncates long rich text at a word boundary", () => {
    expect(htmlToPlainText("<p>alpha bravo charlie delta</p>", 13)).toBe(
      "alpha bravo…",
    );
  });
});

describe("escapeHtml", () => {
  it("escapes all dangerous characters", () => {
    expect(escapeHtml('<script>"x"&\'y\'</script>')).toBe(
      "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;",
    );
  });

  it("is safe inside an attribute value", () => {
    const escaped = escapeHtml('" onload="alert(1)');
    expect(escaped).not.toContain('"');
  });
});