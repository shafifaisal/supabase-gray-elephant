import { z } from "zod";

/** Login form schema. Shared by the client form and the server action. */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .max(254),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters")
    .max(200),
  next: z
    .string()
    .optional()
    // Block absolute URLs and protocol-relative "//host" targets, which would
    // otherwise allow an open redirect after sign-in.
    .refine(
      (value) =>
        !value ||
        (value.startsWith("/") &&
          !value.startsWith("//") &&
          !value.startsWith("/\\")),
      "Invalid redirect target",
    ),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Password reset request. Deliberately generic so it never reveals whether an
 * account exists.
 */
export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address").max(254),
});

/** New password chosen during the reset flow. */
export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, "Choose a password of at least 12 characters")
      .max(200)
      .refine((value) => /[a-z]/.test(value), "Include a lowercase letter")
      .refine((value) => /[A-Z]/.test(value), "Include an uppercase letter")
      .refine((value) => /\d/.test(value), "Include a number"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Contact form schema (Phase 6 wires the handler). */
export const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email address").max(254),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(5000),
  // Honeypot: must stay empty. Bots that fill it in are silently rejected.
  website: z.string().max(0, "Rejected").optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;