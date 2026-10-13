"use server";

import { headers } from "next/headers";

import { contactSchema } from "@/lib/validation/auth";
import { createClient } from "@/lib/supabase/server";

export interface ContactState {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * In-memory rate limiter.
 *
 * Adequate for a single Vercel instance, but NOT reliable across serverless
 * instances — each invocation may get a cold, isolated memory. A distributed
 * limiter (Upstash Redis, or a Postgres table) is required before launch. This
 * is recorded as a known limitation rather than presented as sufficient.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = Number(process.env.CONTACT_RATE_LIMIT_PER_HOUR ?? 5);

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  if (entry.count >= MAX_PER_WINDOW) return true;

  entry.count += 1;
  return false;
}

export async function contactAction(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    mobile: formData.get("mobile") ?? "",
    subject: formData.get("subject"),
    message: formData.get("message"),
    website: formData.get("website") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { fieldErrors };
  }

  // Honeypot: silently accept so bots learn nothing.
  if (parsed.data.website) return { success: true };

  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? null;

  if (ip && rateLimited(ip)) {
    return {
      error: "Too many messages from your connection. Please try again later.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("contact_messages").insert({
    name: parsed.data.name,
    email: parsed.data.email,
    mobile: parsed.data.mobile || null,
    subject: parsed.data.subject,
    message: parsed.data.message,
    ip_address: ip,
    user_agent: headerList.get("user-agent"),
  });

  if (error) {
    return { error: "Your message could not be sent. Please try again." };
  }

  return { success: true };
}