"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrorsFrom,
  settingSchema,
  type ActionState,
} from "@/lib/validation/article";

/**
 * Saves a site setting.
 *
 * Defined here rather than re-exported from another module: Next.js cannot turn
 * a re-exported server action into a client reference, so passing one to a client
 * component fails at runtime with "Cannot read properties of undefined".
 */
export async function saveSettingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("admin");

  const raw = formData.get("value");
  const isSecret = formData.get("is_secret") === "on";

  const parsed = settingSchema.safeParse({
    key: formData.get("key"),
    value: raw,
    is_secret: isSecret,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();

  // Interpret the value as JSON when possible, so structured settings work.
  let value: unknown = parsed.data.value;
  try {
    value = JSON.parse(String(raw));
  } catch {
    value = raw;
  }

  const { error } = await supabase.from("site_settings").upsert({
    key: parsed.data.key,
    value,
    is_secret: isSecret,
    updated_by: actor.id,
  });

  if (error) {
    return { error: `Could not save the setting: ${error.message}` };
  }

  await supabase.from("audit_logs").insert({
    actor_id: actor.id,
    action: "setting.updated",
    entity_type: "setting",
    entity_id: parsed.data.key,
  });

  revalidatePath("/admin/settings");

  // Settings are global: the footer, header wordmark, page titles/meta and the
  // legal pages are statically prerendered from the root layout/page data. Save
  // must invalidate them, or the change only appears after a redeploy.
  revalidatePath("/", "layout");

  return { success: true };
}

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
  // Deleting a setting reverts it to the static config everywhere on the site.
  revalidatePath("/", "layout");
}

export type SettingsAction = typeof saveSettingAction;
export type { ActionState };