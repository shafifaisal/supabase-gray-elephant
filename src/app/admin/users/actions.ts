"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrorsFrom,
  settingSchema,
  userRoleSchema,
  type ActionState,
} from "@/lib/validation/article";

/** Changes a user's role. Administrators only; the database re-checks. */
export async function changeUserRoleAction(formData: FormData): Promise<void> {
  const actor = await requireRole("admin");

  const parsed = userRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    status: formData.get("status") ?? "active",
  });

  if (!parsed.success) {
    redirect(`/admin/users?error=${encodeURIComponent("Invalid request")}`);
  }

  const { userId, role, status } = parsed.data;

  // Guard against removing the last administrator, which would lock everyone
  // out of the panel permanently.
  if (role !== "admin") {
    const supabase = await createClient();

    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    if ((count ?? 0) <= 1) {
      redirect("/admin/users?error=The+last+administrator+cannot+be+demoted");
    }
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ role, status })
    .eq("id", userId);

  if (error) {
    redirect(`/admin/users?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.from("audit_logs").insert({
    actor_id: actor.id,
    action: "profile.role_changed",
    entity_type: "profile",
    entity_id: userId,
    after_state: { role, status },
  });

  revalidatePath("/admin/users");

  redirect("/admin/users?saved=1");
}

/** Saves a site setting. Administrators only. */
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

  return { success: true };
}

/** Publishes scheduled articles whose time has arrived. */
export async function runScheduledPublishAction(): Promise<void> {
  await requireRole("editor");

  const { publishDueArticles } = await import("@/app/admin/articles/actions");
  await publishDueArticles();

  redirect("/admin/articles?published=1");
}