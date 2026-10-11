"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/validation/article";

import { saveSettingAction } from "@/app/admin/users/actions";

export { saveSettingAction };

/**
 * Reads site settings for the admin screen.
 *
 * Administrators only. Secret values are deliberately NOT returned — only the
 * key and the fact that it exists — so an admin screen can never be the place
 * a credential leaks from.
 */
export async function getSettings() {
  await requireRole("admin");

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value, is_secret, updated_at")
    .order("key");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    key: row.key,
    // A secret's value is never returned to the browser.
    value: row.is_secret ? null : JSON.stringify(row.value),
    is_secret: row.is_secret,
    isJson: !row.is_secret && typeof row.value === "object",
  }));
}

export async function deleteSettingAction(formData: FormData): Promise<void> {
  const actor = await requireRole("admin");

  const key = String(formData.get("key") ?? "");
  if (!key) return;

  const supabase = await createClient();
  await supabase.from("site_settings").delete().eq("key", key);

  await supabase.from("audit_logs").insert({
    actor_id: actor.id,
    action: "setting.deleted",
    entity_type: "setting",
    entity_id: key,
  });

  revalidatePath("/admin/settings");
}

export type SettingsAction = typeof saveSettingAction;
export type { ActionState };