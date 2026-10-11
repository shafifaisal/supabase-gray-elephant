import { describe, expect, it } from "vitest";

import { getTool, toolPath, tools } from "@/lib/tools";

describe("tool registry", () => {
  it("exposes exactly the five required tools", () => {
    expect(tools.map((tool) => tool.slug)).toEqual([
      "password-generator",
      "passphrase-generator",
      "password-strength-checker",
      "password-entropy-calculator",
      "random-string-generator",
    ]);
  });

  it("has no duplicate slugs", () => {
    const slugs = tools.map((tool) => tool.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("marks the strength checker as handling sensitive input", () => {
    expect(getTool("password-strength-checker")?.handlesSensitiveInput).toBe(true);
  });

  it("builds correct tool paths", () => {
    expect(toolPath("password-generator")).toBe("/password-generator");
  });
});