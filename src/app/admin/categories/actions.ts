"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  categorySchema,
  fieldErrorsFrom,
  type ActionState,
} from "@/lib/validation/article";

export async function createCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("editor");

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    position: formData.get("position") ?? "0",
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("categories").insert({
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description || null,
    position: parsed.data.position,
  });

  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { slug: "This slug is already in use" } };
    }
    return { error: `Could not create the category: ${error.message}` };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "category.created",
    entity_type: "category",
    entity_id: parsed.data.slug,
    after_state: { name: parsed.data.name, slug: parsed.data.slug },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/articles");

  return { success: true };
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const user = await requireRole("editor");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/categories");

  const supabase = await createClient();

  // Articles keep their content; category_id is ON DELETE SET NULL.
  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (!error) {
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "category.deleted",
      entity_type: "category",
      entity_id: id,
    });
  }

  revalidatePath("/admin/categories");
  revalidatePath("/articles");

  redirect("/admin/categories?deleted=1");
}