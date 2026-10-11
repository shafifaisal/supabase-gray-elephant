import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * OAuth / magic-link callback.
 *
 * Exchanges the one-time code for a session cookie, then redirects onward.
 * Always redirects to a fixed internal path — never to a caller-supplied URL
 * — to avoid an open redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  // Only allow internal, absolute-path redirects.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/admin";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.hash = "";
  return NextResponse.redirect(loginUrl);
}