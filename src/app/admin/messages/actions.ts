"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * The `contact_status` enum values a message may be moved to through the inbox.
 * Kept explicit so a crafted form post cannot write an arbitrary value.
 */
const STATUSES = ["new", "read", "archived"] as const;
type ContactStatus = (typeof STATUSES)[number];

function isStatus(value: string): value is ContactStatus {
  return (STATUSES as readonly string[]).includes(value);
}

/**
 * Moves a contact message between `new`, `read` and `archived`.
 *
 * Admin-only: the `contact_messages_admin_update` RLS policy enforces this in
 * the database as well, so this is a convenience check, not the boundary.
 */
export async function setMessageStatusAction(
  formData: FormData,
): Promise<void> {
  await requireRole("admin");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !isStatus(status)) redirect("/admin/messages");

  const supabase = await createClient();
  const { error } = await supabase
    .from("contact_messages")
    .update({ status })
    .eq("id", id);

  revalidatePath("/admin/messages");

  if (error) {
    redirect(`/admin/messages?error=update`);
  }

  redirect(`/admin/messages?updated=${status}`);
}

/**
 * Permanently deletes a contact message.
 *
 * Admin-only. The `contact_messages_admin_delete` RLS policy is the real
 * boundary; a non-admin's delete simply affects no rows.
 */
export async function deleteMessageAction(formData: FormData): Promise<void> {
  await requireRole("admin");

  const id = String(formData.get("id") ?? "");
  const page = String(formData.get("page") ?? "1");

  if (!id) redirect("/admin/messages");

  const supabase = await createClient();
  const { error } = await supabase
    .from("contact_messages")
    .delete()
    .eq("id", id);

  revalidatePath("/admin/messages");

  if (error) {
    redirect(`/admin/messages?error=delete`);
  }

  redirect(`/admin/messages?page=${encodeURIComponent(page)}`);
}
