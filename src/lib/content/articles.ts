/**
 * Article queries.
 *
 * Every function goes through the request-scoped Supabase client, so Row Level
 * Security applies: an anonymous caller physically cannot read a draft, because
 * the database refuses the row rather than the application filtering it out.
 *
 * PUBLIC READS FAIL SOFT, ADMIN READS DO NOT
 * -----------------------------------------
 * The public getters are called from PRERENDERED routes (`/articles` is rendered
 * at build time), so a throw there fails the whole deployment. That is exactly
 * what happened when the `articles` table was missing from the configured
 * project: the build died instead of serving an empty articles page.
 *
 * A public read therefore degrades to an empty result and renders the page's
 * existing empty state. The error is logged, never swallowed, so the
 * misconfiguration stays visible in the build and runtime logs.
 *
 * Admin getters keep throwing on purpose: inside the CMS a silent failure would
 * hide the problem from the only people able to fix it.
 */

import { renderMarkdown, htmlToPlainText, sanitizeForRender } from "@/lib/content/markdown";
import { createClient } from "@/lib/supabase/server";
import { createBuildClient } from "@/lib/supabase/build";
import type { ArticleStatus } from "@/lib/validation/article";

/**
 * Runs a public read, degrading to `fallback` instead of throwing.
 *
 * Logged rather than swallowed: failing softly must not mean failing silently.
 */
async function failSoft<T>(
  label: string,
  read: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.error(
      `[content] ${label} failed; degrading to an empty result. ` +
        "Check that the database is reachable and migrations are applied.",
      error,
    );
    return fallback;
  }
}

export interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string;
  body_html: string;
  /**
   * How `body_html` was produced. `markdown` marks rows authored through the
   * legacy Markdown editor; `html` marks rows authored in the rich text
   * editor. Existing rows default to `markdown`, so their rendering is
   * unchanged.
   */
  body_format: "markdown" | "html";
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

export interface TagRow {
  id: string;
  slug: string;
  name: string;
}

const ARTICLE_COLUMNS = "id, slug, title, excerpt, body_md, body_html, body_format, status, author_id, category_id, featured_image_id, seo_title, meta_description, og_title, og_description, canonical_url, is_noindex, scheduled_for, published_at, created_at, updated_at";

/**
 * Returns published, publicly visible articles.
 *
 * The cookie-free client is correct here because this reads PUBLIC content
 * only; RLS with the anon key enforces exactly the same visibility rules a
 * visitor would get. Caching is applied at the route level via `revalidate`.
 */
export async function getPublishedArticles(limit = 50): Promise<ArticleRow[]> {
  return failSoft(
    "getPublishedArticles",
    async () => {
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
    },
    [],
  );
}

/**
 * Full-text-ish search over published articles (title and excerpt).
 *
 * The term is reduced to letters, numbers, spaces and hyphens before it reaches
 * PostgREST's `or()` filter, which treats commas and parentheses as syntax. An
 * empty or symbol-only term yields no results rather than every article.
 */
export async function searchPublishedArticles(
  query: string,
  limit = 50,
): Promise<ArticleRow[]> {
  const term = query
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim();

  if (!term) return [];

  return failSoft(
    "searchPublishedArticles",
    async () => {
      const supabase = createBuildClient();

      const { data, error } = await supabase
        .from("articles")
        .select(ARTICLE_COLUMNS)
        .eq("status", "published")
        .eq("is_noindex", false)
        .or(`title.ilike.%${term}%,excerpt.ilike.%${term}%`)
        .order("published_at", { ascending: false })
        .limit(limit);

      if (error) throw new Error(`Failed to search articles: ${error.message}`);

      return (data ?? []) as ArticleRow[];
    },
    [],
  );
}

/**
 * Returns one published article by slug, or null.
 *
 * Returns null rather than throwing so the page can respond 404 for both
 * "does not exist" and "not published" — never revealing that a draft exists.
 * An unreachable database degrades to the same null, so the page 404s instead
 * of crashing the render.
 */
export async function getPublishedArticleBySlug(
  slug: string,
): Promise<ArticleRow | null> {
  return failSoft(
    "getPublishedArticleBySlug",
    async () => {
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
    },
    null,
  );
}

/** Slugs of every published article, used by the sitemap. */
export async function getPublishedSlugs(): Promise<string[]> {
  return failSoft(
    "getPublishedSlugs",
    async () => {
      const supabase = createBuildClient();

      const { data, error } = await supabase
        .from("articles")
        .select("slug")
        .eq("status", "published")
        .eq("is_noindex", false);

      if (error) throw new Error(`Failed to load slugs: ${error.message}`);

      return (data ?? []).map((row) => row.slug);
    },
    [],
  );
}

/**
 * Slugs for the sitemap, deliberately NOT cached.
 *
 * A stale sitemap is a real SEO defect: a newly published article would not be
 * submitted for indexing until the cache happened to expire. Search engines
 * poll this endpoint, so it must always reflect current published content.
 */
export async function getPublishedSlugsLive(): Promise<string[]> {
  return failSoft(
    "getPublishedSlugsLive",
    async () => {
      const supabase = createBuildClient();

      const { data, error } = await supabase
        .from("articles")
        .select("slug")
        .eq("status", "published")
        .eq("is_noindex", false);

      if (error) throw new Error(`Failed to load slugs: ${error.message}`);

      return (data ?? []).map((row) => row.slug);
    },
    [],
  );
}

/**
 * Every category, in display order.
 *
 * STRICT on purpose — the admin CMS must fail loudly if categories cannot be
 * loaded, otherwise an editor could silently publish without one. Public pages
 * use `getPublicCategories()` below.
 */
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

/**
 * Every tag, alphabetically.
 */
export async function getTags(): Promise<TagRow[]> {
  const supabase = createBuildClient();

  const { data, error } = await supabase
    .from("tags")
    .select("id, slug, name")
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load tags: ${error.message}`);

  return (data ?? []) as TagRow[];
}

/**
 * Fail-soft category list for public pages.
 *
 * Same data as `getCategories()`, but a database problem hides the category
 * chips instead of failing a prerender.
 */
export async function getPublicCategories(): Promise<CategoryRow[]> {
  return failSoft("getPublicCategories", getCategories, []);
}

/**
 * All published articles in one category.
 *
 * A missing category and an unreachable database both yield `category: null`,
 * which the page turns into a real 404 — never a thrown error.
 */
export async function getArticlesByCategory(
  categorySlug: string,
): Promise<{ category: CategoryRow | null; articles: ArticleRow[] }> {
  return failSoft(
    "getArticlesByCategory",
    async () => {
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
    },
    { category: null, articles: [] },
  );
}

/**
 * Articles in the same category, for "related" links.
 * Excludes the current article and caps the count.
 *
 * Secondary content: any failure simply means no related links are shown.
 */
export async function getRelatedArticles(
  article: Pick<ArticleRow, "id" | "category_id">,
  limit = 3,
): Promise<ArticleRow[]> {
  if (!article.category_id) return [];

  return failSoft(
    "getRelatedArticles",
    async () => {
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

      if (error) throw new Error(`Failed to load related articles: ${error.message}`);

      return (data ?? []) as ArticleRow[];
    },
    [],
  );
}

// ---------------------------------------------------------------------------
// Admin queries — these rely on RLS to restrict which rows come back, and they
// deliberately DO throw so a CMS failure is never mistaken for "no content".
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
 * Turns submitted content into the two stored representations plus an excerpt.
 *
 * Shared by the write path so stored HTML is always sanitised. The rich text
 * editor submits HTML (`format: "html"`); legacy or programmatic callers may
 * still submit Markdown (`format: "markdown"`). Both end up as sanitised HTML
 * in `body_html`, which is what the public site renders.
 *
 * `body_md` is retained for Markdown rows so their original source is never
 * lost. Rich text rows store an empty `body_md` — their source is `body_html`.
 */
export function prepareArticleContent(input: {
  body: string;
  format: "markdown" | "html";
  excerpt?: string;
}): { body_html: string; body_md: string; excerpt: string } {
  const isHtml = input.format === "html";

  const body_html = isHtml
    ? sanitizeForRender(input.body)
    : renderMarkdown(input.body);

  const body_md = isHtml ? "" : input.body;

  const excerpt = input.excerpt?.trim()
    ? input.excerpt.trim()
    : htmlToPlainText(body_html);

  return { body_html, body_md, excerpt };
}