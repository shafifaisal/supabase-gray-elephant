import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";

/**
 * GET /api/auth/status
 *
 * Lightweight "am I signed in?" probe for the public header, which shows a
 * Logout control only for authenticated staff. Returning a bare boolean lets
 * the header stay a client component without forcing every public page to
 * become dynamic by reading the session cookie during render.
 *
 * Exposes no personal data and is never cached.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();

  return NextResponse.json(
    { authenticated: user !== null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
