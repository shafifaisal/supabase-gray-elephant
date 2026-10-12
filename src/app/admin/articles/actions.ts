"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getArticleForEdit,
  prepareArticleContent,
  slugExists,
} from "@/lib/content/articles";
import { roleAtLeast, requireRole } from "@/lib/auth/session";
import { cleanupUnusedMedia } from "@/lib/media/featured-image";
import { createClient } from "@/lib/supabase/server";
import {
  articleSchema,
  fieldErrorsFrom,
  type ActionState,
} from "@/lib/validation/article";

/**
 * Server Actions for the article workflow.
 *
 * SECURITY RULES enforced here and in the database:
 *  * Every action re-checks the session and role on the server. UI visibility
 *    is cosmetic; RLS is the authority.
 *  * Markdown is rendered and sanitised before storage, never on read.
 *  * Every state change writes an audit log row.
 *  * Publishing is an editor/admin action, enforced by both a role check here
 *    and a trigger in Postgres.
 */

/** Records an administrative action. Never throws into the caller. */
async function audit(params: {
  action: string;
  entityType: string;
  entityId?: string;
  actorId?: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("audit_logs").insert({
      actor_id: params.actorId ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      before_state: params.before ?? null,
      after_state: params.after ?? null,
    });
  } catch {
    // Auditing must never break the user's action.
  }
}

function parseForm(formData: FormData) {
  return articleSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    excerpt: formData.get("excerpt") ?? "",
    body_html: formData.get("body_html") ?? "",
    body_format: formData.get("body_format") ?? "html",
    category_id: formData.get("category_id") ?? "",
    seo_title: formData.get("seo_title") ?? "",
    meta_description: formData.get("meta_description") ?? "",
    og_title: formData.get("og_title") ?? "",
    og_description: formData.get("og_description") ?? "",
    canonical_url: formData.get("canonical_url") ?? "",
    is_noindex: formData.get("is_noindex") ?? "",
    featured_image_id: formData.get("featured_image_id") ?? "",
    scheduled_for: formData.get("scheduled_for") ?? "",
  });
}

/**
 * Creates a draft article owned by the signed-in author.
 * Authors may only create drafts — never published content.
 */
export async function createArticleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("author");
  const canPublish = roleAtLeast(user.role, "editor");

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const input = parsed.data;

  if (await slugExists(input.slug)) {
    return { fieldErrors: { slug: "This slug is already in use" } };
  }

  const { body_html, body_md, excerpt } = prepareArticleContent({
    body: input.body_html,
    format: input.body_format,
    excerpt: input.excerpt,
  });

  // An editor/admin who chose "Save and publish".
  const publishNow = canPublish && formData.get("intent") === "publish";

  const supabase = await createClient();

  // Insert as a draft regardless: the insert policy only permits draft/in_review
  // rows. Publishing is a separate, editor-only update (see below).
  const { data, error } = await supabase
    .from("articles")
    .insert({
      slug: input.slug,
      title: input.title,
      excerpt,
      body_md,
      body_html,
      body_format: input.body_format,
      status: "draft",
      author_id: user.id,
      category_id: input.category_id,
      seo_title: input.seo_title || null,
      meta_description: input.meta_description || null,
      og_title: input.og_title || null,
      og_description: input.og_description || null,
      canonical_url: input.canonical_url || null,
      is_noindex: input.is_noindex,
      featured_image_id: input.featured_image_id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: `Could not create the article: ${error.message}` };
  }

  if (publishNow) {
    const { error: publishError } = await supabase
      .from("articles")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", data.id);

    if (publishError) {
      // The draft exists; send the editor to it rather than lose the work.
      redirect(
        `/admin/articles/${data.id}/edit?error=${encodeURIComponent(
          `Draft saved, but publishing failed: ${publishError.message}`,
        )}`,
      );
    }
  }

  await audit({
    action: "article.created",
    entityType: "article",
    entityId: data.id,
    actorId: user.id,
    after: {
      slug: input.slug,
      title: input.title,
      status: publishNow ? "published" : "draft",
    },
  });

  redirect(
    publishNow
      ? `/admin/articles/${data.id}/edit?saved=published`
      : `/admin/articles/${data.id}/edit?created=1`,
  );
}

/** Saves edits to an existing article and appends a revision. */
export async function updateArticleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("author");
  const canPublish = roleAtLeast(user.role, "editor");

  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { error: "Missing article id" };
  }

  const existing = await getArticleForEdit(id);
  if (!existing) return { error: "Article not found" };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const input = parsed.data;

  if (await slugExists(input.slug, id)) {
    return { fieldErrors: { slug: "This slug is already in use" } };
  }

  const { body_html, body_md, excerpt } = prepareArticleContent({
    body: input.body_html,
    format: input.body_format,
    excerpt: input.excerpt,
  });

  // An editor/admin who chose "Save and publish" on a not-yet-published article.
  const publishNow =
    canPublish && formData.get("intent") === "publish" && existing.status !== "published";

  const supabase = await createClient();

  const patch: Record<string, unknown> = {
    slug: input.slug,
    title: input.title,
    excerpt,
    body_md,
    body_html,
    body_format: input.body_format,
    category_id: input.category_id,
    seo_title: input.seo_title || null,
    meta_description: input.meta_description || null,
    og_title: input.og_title || null,
    og_description: input.og_description || null,
    canonical_url: input.canonical_url || null,
    is_noindex: input.is_noindex,
    featured_image_id: input.featured_image_id,
  };

  if (publishNow) {
    patch.status = "published";
    if (!existing.published_at) {
      patch.published_at = new Date().toISOString();
    }
  }

  // Authors may only modify their own draft or in-review article. RLS enforces
  // this too; the read above already proves visibility.
  const { error } = await supabase.from("articles").update(patch).eq("id", id);

  if (error) {
    return { error: `Could not save the article: ${error.message}` };
  }

  // The featured image was replaced or removed: delete the previous asset once
  // nothing else references it. Best effort, and never blocks the save.
  if (
    existing.featured_image_id &&
    existing.featured_image_id !== input.featured_image_id
  ) {
    await cleanupUnusedMedia(existing.featured_image_id);
  }

  // Append a revision. Revisions are immutable, so this is a plain insert and
  // the next revision number is derived from the current count.
  const { count } = await supabase
    .from("article_revisions")
    .select("id", { count: "exact", head: true })
    .eq("article_id", id);

  await supabase.from("article_revisions").insert({
    article_id: id,
    revision_number: (count ?? 0) + 1,
    title: input.title,
    excerpt,
    body_md,
    body_html,
    status: publishNow ? "published" : existing.status,
    change_note: String(formData.get("change_note") ?? "").slice(0, 200) || null,
    changed_by: user.id,
  });

  await audit({
    action: publishNow ? "article.published" : "article.updated",
    entityType: "article",
    entityId: id,
    actorId: user.id,
    before: { slug: existing.slug, title: existing.title, status: existing.status },
    after: {
      slug: input.slug,
      title: input.title,
      status: publishNow ? "published" : existing.status,
    },
  });

  revalidatePath("/admin/articles");
  revalidatePath(`/admin/articles/${id}/edit`);

  // A title, excerpt or featured image may have changed on a published article;
  // refresh the public surfaces that render it.
  revalidatePath("/");
  revalidatePath("/articles");
  revalidatePath(`/articles/${input.slug}`);
  if (existing.slug !== input.slug) {
    revalidatePath(`/articles/${existing.slug}`);
  }
  if (publishNow) {
    revalidatePath("/sitemap.xml");
  }

  return { success: true };
}

/**
 * Changes publication status.
 *
 * Editors and administrators only. Authors cannot reach this: their RLS policy
 * plus the `articles_guard_publish` trigger both refuse the transition.
 */
export async function changeStatusAction(formData: FormData): Promise<void> {
  const user = await requireRole("editor");

  const id = String(formData.get("articleId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id) redirect("/admin/articles?error=missing-id");

  const existing = await getArticleForEdit(id);
  if (!existing) redirect("/admin/articles?error=not-found");

  const now = new Date().toISOString();
  const scheduledFor = String(formData.get("scheduledFor") ?? "");

  const patch: Record<string, unknown> = { status };

  if (status === "published") {
    patch.published_at = now;
  }

  if (status === "scheduled") {
    const when = scheduledFor ? new Date(scheduledFor) : null;
    if (!when || Number.isNaN(when.getTime())) {
      redirect(`/admin/articles/${id}/edit?error=scheduled-date`);
    }
    patch.scheduled_for = when!.toISOString();
    patch.published_at = when!.toISOString();
  }

  const supabase = await createClient();

  const { error } = await supabase.from("articles").update(patch).eq("id", id);

  if (error) {
    redirect(`/admin/articles/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  await audit({
    action: `article.${status}`,
    entityType: "article",
    entityId: id,
    actorId: user.id,
    before: { status: existing.status },
    after: { status },
  });

  // Publishing must invalidate the public caches immediately.
  if (status === "published" || status === "archived") {
    revalidatePath("/");
    revalidatePath("/articles");
    revalidatePath(`/articles/${existing.slug}`);
    revalidatePath("/sitemap.xml");
  }

  redirect(`/admin/articles/${id}/edit?saved=${status}`);
}

/** Permanently deletes an article. Administrators only. */
export async function deleteArticleAction(formData: FormData): Promise<void> {
  const user = await requireRole("admin");

  const id = String(formData.get("articleId") ?? "");
  if (!id) redirect("/admin/articles");

  const existing = await getArticleForEdit(id);
  if (!existing) redirect("/admin/articles");

  const supabase = await createClient();
  const { error } = await supabase.from("articles").delete().eq("id", id);

  if (error) {
    redirect(`/admin/articles?error=${encodeURIComponent(error.message)}`);
  }

  await audit({
    action: "article.deleted",
    entityType: "article",
    entityId: id,
    actorId: user.id,
    before: { slug: existing.slug, title: existing.title },
  });

  // Remove the featured image if this was the last thing pointing at it.
  if (existing.featured_image_id) {
    await cleanupUnusedMedia(existing.featured_image_id);
  }

  revalidatePath("/");
  revalidatePath("/articles");
  revalidatePath(`/articles/${existing.slug}`);
  revalidatePath("/sitemap.xml");

  redirect("/admin/articles?deleted=1");
}

/**
 * Publishes every scheduled article whose time has arrived.
 *
 * Intended to be invoked by a scheduled job or an on-demand trigger. Safe to
 * call repeatedly: already-published rows no longer match.
 */
export async function publishDueArticles(): Promise<number> {
  await requireRole("editor");

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("articles")
    .update({ status: "published", published_at: now })
    .eq("status", "scheduled")
    .lte("scheduled_for", now)
    .select("id, slug");

  if (error) return 0;

  for (const article of data ?? []) {
    await audit({
      action: "article.published_scheduled",
      entityType: "article",
      entityId: article.id,
      after: { slug: article.slug, status: "published" },
    });
    revalidatePath("/");
    revalidatePath("/articles");
    revalidatePath(`/articles/${article.slug}`);
  }

  revalidatePath("/sitemap.xml");

  return (data ?? []).length;
}

export { roleAtLeast };