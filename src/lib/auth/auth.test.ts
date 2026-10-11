import { describe, expect, it } from "vitest";

import { ROLES, roleAtLeast } from "@/lib/auth/session";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";

describe("roleAtLeast", () => {
  it("ranks roles correctly", () => {
    expect(roleAtLeast("admin", "author")).toBe(true);
    expect(roleAtLeast("admin", "editor")).toBe(true);
    expect(roleAtLeast("admin", "admin")).toBe(true);
    expect(roleAtLeast("editor", "editor")).toBe(true);
    expect(roleAtLeast("editor", "admin")).toBe(false);
    expect(roleAtLeast("author", "editor")).toBe(false);
    expect(roleAtLeast("author", "author")).toBe(true);
  });

  it("treats a missing role as unauthorised", () => {
    expect(roleAtLeast(undefined, "author")).toBe(false);
  });

  it("exposes exactly the three documented roles", () => {
    expect([...ROLES]).toEqual(["admin", "editor", "author"]);
  });
});

describe("loginSchema", () => {
  it("accepts a valid credential pair", () => {
    const result = loginSchema.safeParse({
      email: "admin@example.com",
      password: "correct horse battery",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "abcdefgh" }).success).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.com", password: "" }).success,
    ).toBe(false);
  });

  it("blocks open-redirect targets", () => {
    const evil = loginSchema.safeParse({
      email: "a@b.com",
      password: "abcdefgh",
      next: "https://evil.example.com",
    });
    expect(evil.success).toBe(false);

    const protocolRelative = loginSchema.safeParse({
      email: "a@b.com",
      password: "abcdefgh",
      next: "//evil.example.com",
    });
    expect(protocolRelative.success).toBe(false);
  });

  it("permits internal redirect targets", () => {
    const ok = loginSchema.safeParse({
      email: "a@b.com",
      password: "abcdefgh",
      next: "/admin/articles",
    });
    expect(ok.success).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  const valid = { password: "Str0ngPassphrase", confirmPassword: "Str0ngPassphrase" };

  it("accepts a strong matching pair", () => {
    expect(resetPasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects mismatched confirmation", () => {
    const result = resetPasswordSchema.safeParse({
      password: "Str0ngPassphrase",
      confirmPassword: "different",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a short password", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "Ab1short",
        confirmPassword: "Ab1short",
      }).success,
    ).toBe(false);
  });

  it("requires a mix of character classes", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "alllowercasepassword",
        confirmPassword: "alllowercasepassword",
      }).success,
    ).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("requires a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "user@example.com" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
  });
});