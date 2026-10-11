/**
 * Article queries.
 *
 * Every function goes through the request-scoped Supabase client, so Row Level
 * Security applies: an anonymous caller physically cannot read a draft, because
 * the database refuses the row rather than the application filtering it out.
 */

import { renderMarkdown, markdownToPlainText } from "@/lib/content/markdown";
import { createClient } from "@/lib/supabase/server";
import { createBuildClient } from "@/lib/supabase/build";
import type { ArticleStatus } from "@/lib/validation/article";

export interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string;
  body_html: string;
  status: ArticleStatus;
  author_id: string | null;
  category_id: string | null;
  featured_image_id: string | null;
  seo_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  canonical_url: string | null;
  is_noindex: boolean;
  scheduled_for: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
}

const ARTICLE_COLUMNS = "id, slug, title, excerpt, body_md, body_html, status, author_id, category_id, featured_image_id, seo_title, meta_description, og_title, og_description, canonical_url, is_noindex, scheduled_for, published_at, created_at, updated_at";

/**
 * Returns published, publicly visible articles.
 *
 * The cookie-free client is correct here because this reads PUBLIC content
 * only; RLS with the anon key enforces exactly the same visibility rules a
 * visitor would get. Caching is applied at the route level via `revalidate`.
 */
export async function getPublishedArticles(limit = 50): Promise<ArticleRow[]> {
  const supabase = createBuildClient();

  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_COLUMNS)
    .eq("status", "published")
    .eq("is_noindex", false)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load articles: ${error.message}`);

  return (data ?? []) as ArticleRow[];
}

/**
 * Returns one published article by slug, or null.
 *
 * Returns null rather than throwing so the page can respond 404 for both
 * "does not exist" and "not published" — never revealing that a draft exists.
 */
export async function getPublishedArticleBySlug(
  slug: string,
): Promise<ArticleRow | null> {
  const supabase = createBuildClient();

  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .eq("is_noindex", false)
    .maybeSingle<ArticleRow>();

  if (error) throw new Error(`Failed to load article: ${error.message}`);

  return data ?? null;
}

/** Slugs of every published article, used by the sitemap. */
export async function getPublishedSlugs(): Promise<string[]> {
  const supabase = createBuildClient();

  const { data, error } = await supabase
    .from("articles")
    .select("slug")
    .eq("status", "published")
    .eq("is_noindex", false);

  if (error) throw new Error(`Failed to load slugs: ${error.message}`);

  return (data ?? []).map((row) => row.slug);
}

/**
 * Slugs for the sitemap, deliberately NOT cached.
 *
 * A stale sitemap is a real SEO defect: a newly published article would not be
 * submitted for indexing until the cache happened to expire. Search engines
 * poll this endpoint, so it must always reflect current published content.
 */
export async function getPublishedSlugsLive(): Promise<string[]> {
  const supabase = createBuildClient();

  const { data, error } = await supabase
    .from("articles")
    .select("slug")
    .eq("status", "published")
    .eq("is_noindex", false);

  if (error) throw new Error(`Failed to load slugs: ${error.message}`);

  return (data ?? []).map((row) => row.slug);
}

export async function getCategories(): Promise<CategoryRow[]> {
  const supabase = createBuildClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, description, position")
    .order("position", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load categories: ${error.message}`);

  return (data ?? []) as CategoryRow[];
}

/** All published articles in one category. */
export async function getArticlesByCategory(
  categorySlug: string,
): Promise<{ category: CategoryRow | null; articles: ArticleRow[] }> {
  const supabase = createBuildClient();

  const { data: category } = await supabase
    .from("categories")
    .select("id, slug, name, description, position")
    .eq("slug", categorySlug)
    .maybeSingle<CategoryRow>();

  if (!category) return { category: null, articles: [] };

  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_COLUMNS)
    .eq("status", "published")
    .eq("is_noindex", false)
    .eq("category_id", category.id)
    .order("published_at", { ascending: false });

  if (error) throw new Error(`Failed to load articles: ${error.message}`);

  return { category, articles: (data ?? []) as ArticleRow[] };
}

/**
 * Articles in the same category, for "related" links.
 * Excludes the current article and caps the count.
 */
export async function getRelatedArticles(
  article: Pick<ArticleRow, "id" | "category_id">,
  limit = 3,
): Promise<ArticleRow[]> {
  if (!article.category_id) return [];

  const supabase = createBuildClient();

  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_COLUMNS)
    .eq("status", "published")
    .eq("is_noindex", false)
    .eq("category_id", article.category_id)
    .neq("id", article.id)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) return [];

  return (data ?? []) as ArticleRow[];
}

// ---------------------------------------------------------------------------
// Admin queries — these rely on RLS to restrict which rows come back.
// ---------------------------------------------------------------------------

/** Articles visible to the signed-in staff member (any status). */
export async function getAdminArticles(): Promise<
  (ArticleRow & { author: { email: string | null } | null })[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("articles")
    .select("id, slug, title, excerpt, status, author_id, category_id, scheduled_for, published_at, created_at, updated_at, profiles(email)")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to load articles: ${error.message}`);

  return (data ?? []) as unknown as (ArticleRow & {
    author: { email: string | null } | null;
  })[];
}

export async function getArticleForEdit(id: string): Promise<ArticleRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_COLUMNS)
    .eq("id", id)
    .maybeSingle<ArticleRow>();

  if (error) throw new Error(`Failed to load article: ${error.message}`);

  return data ?? null;
}

export async function getRevisions(articleId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("article_revisions")
    .select("id, revision_number, title, status, change_note, changed_by, created_at")
    .eq("article_id", articleId)
    .order("revision_number", { ascending: false })
    .limit(50);

  if (error) return [];

  return data ?? [];
}

/**
 * True when the slug is already taken by a different article.
 * Used for friendly duplicate-slug validation before a write.
 */
export async function slugExists(
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const supabase = await createClient();

  let query = supabase.from("articles").select("id").eq("slug", slug);

  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query.limit(1);

  if (error) return false;

  return (data ?? []).length > 0;
}

/**
 * Renders and sanitises article content.
 * Shared by the write path so stored HTML is always sanitised.
 */
export function prepareArticleContent(input: {
  body_md: string;
  excerpt?: string;
}): { body_html: string; excerpt: string } {
  const body_html = renderMarkdown(input.body_md);
  const excerpt = input.excerpt?.trim()
    ? input.excerpt.trim()
    : markdownToPlainText(input.body_md);

  return { body_html, excerpt };
}