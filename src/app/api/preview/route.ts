import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { sanitizeForRender } from "@/lib/content/markdown";
import { MAX_BODY_LENGTH } from "@/lib/validation/article";

/**
 * Sanitises rich text HTML for the editor preview.
 *
 * The visual editor is already WYSIWYG, but a preview that matches the final
 * rendering exactly is still useful. Authentication is required: this is an
 * admin tool and unauthenticated visitors have no reason to call it.
 *
 * The response goes through exactly the same `sanitizeForRender` used for
 * published articles, so the preview can never be more permissive than the
 * final output.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let html = "";

  try {
    html = (await request.text()).slice(0, MAX_BODY_LENGTH);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  return new NextResponse(sanitizeForRender(html), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Authoring aid only: never cached or indexed.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
