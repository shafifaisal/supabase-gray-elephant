import { NextResponse } from "next/server";

import { assertRole, AuthError } from "@/lib/auth/session";
import { getAllContactMessages } from "@/lib/content/contact-messages";
import { buildXlsx } from "@/lib/xlsx";

/**
 * GET /admin/messages/export
 *
 * Downloads every contact message (all fields except the internal row id) as an
 * `.xlsx` workbook that opens directly in Excel. Staff-only: the same
 * `is_editor()` role that can read the inbox may export it, and the RLS policy
 * on `contact_messages` is the real boundary — this check exists so an API
 * caller gets a clean 401/403 rather than an empty file.
 *
 * The response is marked `no-store` (it contains personal data) and is never
 * cached by a shared proxy.
 */
export const dynamic = "force-dynamic";

const SHEET_NAME = "Messages";

const EXPORT_HEADERS = [
  "Name",
  "Email",
  "WhatsApp",
  "Subject",
  "Message",
  "Status",
  "Received (UTC)",
] as const;

export async function GET() {
  try {
    await assertRole("editor");
  } catch (error) {
    if (error instanceof AuthError) {
      return new NextResponse(error.message, { status: error.status });
    }
    throw error;
  }

  const messages = await getAllContactMessages();

  const rows = [
    [...EXPORT_HEADERS],
    ...messages.map((message) => [
      message.name,
      message.email,
      message.mobile ?? "",
      message.subject,
      message.message,
      message.status,
      message.created_at,
    ]),
  ];

  const workbook = buildXlsx(SHEET_NAME, rows);
  const filename = `messages-${new Date().toISOString().slice(0, 10)}.xlsx`;

  const body = new Blob([workbook], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
