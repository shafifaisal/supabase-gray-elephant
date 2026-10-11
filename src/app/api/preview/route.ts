import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { renderMarkdown } from "@/lib/content/markdown";

/**
 * Renders Markdown to sanitised HTML for the editor preview.
 *
 * Authentication is required: this is an admin tool and unauthenticated
 * visitors have no reason to call it.
 *
 * The response goes through exactly the same `renderMarkdown` sanitizer used
 * for published articles, so the preview cannot be more permissive than the
 * final output.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let markdown = "";

  try {
    markdown = (await request.text()).slice(0, 100_000);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  return new NextResponse(renderMarkdown(markdown), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Authoring aid only: never cached or indexed.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}