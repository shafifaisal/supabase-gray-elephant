"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrorsFrom,
  tagSchema,
  type ActionState,
} from "@/lib/validation/article";

export async function createTagAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("editor");

  const parsed = tagSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("tags").insert({
    name: parsed.data.name,
    slug: parsed.data.slug,
  });

  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { slug: "This slug is already in use" } };
    }
    return { error: `Could not create the tag: ${error.message}` };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "tag.created",
    entity_type: "tag",
    entity_id: parsed.data.slug,
    after_state: { name: parsed.data.name, slug: parsed.data.slug },
  });

  revalidatePath("/admin/tags");

  return { success: true };
}

export async function deleteTagAction(formData: FormData): Promise<void> {
  const user = await requireRole("editor");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/tags");

  const supabase = await createClient();

  // Article links are removed by ON DELETE CASCADE on article_tags.
  const { error } = await supabase.from("tags").delete().eq("id", id);

  if (!error) {
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "tag.deleted",
      entity_type: "tag",
      entity_id: id,
    });
  }

  revalidatePath("/admin/tags");

  redirect("/admin/tags?deleted=1");
}
