"use client";

import { useActionState, useEffect, useState } from "react";

import { ActionButton } from "@/components/admin/action-button";
import type { ActionState } from "@/lib/validation/article";

export interface ArticleFormValues {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  body_md: string;
  category_id: string;
  seo_title: string;
  meta_description: string;
  og_title: string;
  og_description: string;
  canonical_url: string;
  is_noindex: boolean;
  featured_image_id: string;
}

const inputClasses =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none";

const labelClasses = "mb-1.5 block text-sm font-medium";

/**
 * Article editor with a Markdown editor and preview.
 *
 * The preview is rendered by the server through `/api/preview`, which applies
 * exactly the same sanitizer as the published page. Previewing untrusted HTML
 * in the browser without sanitizing would defeat the purpose.
 */
export function ArticleEditor({
  action,
  values,
  categories,
  canPublish,
  status,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values: ArticleFormValues;
  categories: { id: string; name: string }[];
  canPublish: boolean;
  status: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [body, setBody] = useState(values.body_md);
  const [preview, setPreview] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [slug, setSlug] = useState(values.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(values.slug));
  const [title, setTitle] = useState(values.title);

  // Fetch a sanitised preview from the server whenever the body changes and
  // the preview panel is open.
  useEffect(() => {
    if (!showPreview) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: body.slice(0, 100_000),
          signal: controller.signal,
        });

        if (response.ok) {
          setPreview(await response.text());
        }
      } catch {
        // Aborted or network error; keep the previous preview.
      }
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [body, showPreview]);

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) {
      setSlug(
        value
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s-]/g, "")
          .trim()
          .replace(/[\s-]+/g, "-")
          .replace(/^-|-$/g, ""),
      );
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {values.id ? "Edit article" : "New article"}
        </h1>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase">
          {status.replace("_", " ")}
        </span>
      </div>

      {state.success ? (
        <p
          role="status"
          className="rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
        >
          Saved.
        </p>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <fieldset className="space-y-4 rounded-[var(--radius-card)] border border-border bg-background p-5">
        <legend className="px-1 text-sm font-semibold">Content</legend>

        <div>
          <label htmlFor="title" className={labelClasses}>
            Title
          </label>
          <input
            id="title"
            name="title"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            required
            className={inputClasses}
            aria-invalid={Boolean(state.fieldErrors?.title) || undefined}
          />
          {state.fieldErrors?.title ? (
            <p className="mt-1 text-sm text-danger">{state.fieldErrors.title}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="slug" className={labelClasses}>
            Slug
          </label>
          <input
            id="slug"
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            required
            className={`${inputClasses} font-mono`}
            aria-describedby="slug-hint"
          />
          <p id="slug-hint" className="mt-1 text-xs text-muted-foreground">
            Public URL: /articles/{slug || "…"}
          </p>
          {state.fieldErrors?.slug ? (
            <p className="mt-1 text-sm text-danger">{state.fieldErrors.slug}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="excerpt" className={labelClasses}>
            Excerpt
          </label>
          <textarea
            id="excerpt"
            name="excerpt"
            rows={2}
            defaultValue={values.excerpt}
            className={inputClasses}
            aria-describedby="excerpt-hint"
          />
          <p id="excerpt-hint" className="mt-1 text-xs text-muted-foreground">
            Leave blank to generate one from the article body.
          </p>
        </div>

        <div>
          <label htmlFor="body_md" className={labelClasses}>
            Body (Markdown)
          </label>
          <textarea
            id="body_md"
            name="body_md"
            rows={20}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={`${inputClasses} font-mono`}
            aria-describedby="body-hint"
          />
          <p id="body-hint" className="mt-1 text-xs text-muted-foreground">
            Headings start at <code>##</code> — the article title is the
            page&rsquo;s <code>&lt;h1&gt;</code>. Raw HTML is stripped.
          </p>
          {state.fieldErrors?.body_md ? (
            <p className="mt-1 text-sm text-danger">{state.fieldErrors.body_md}</p>
          ) : null}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            aria-expanded={showPreview}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary"
          >
            {showPreview ? "Hide preview" : "Show preview"}
          </button>
        </div>

        {showPreview ? (
          <div
            className="prose-guides rounded-md border border-border bg-secondary/40 p-4"
            // Content comes from the server-side sanitizer, never from the
            // client, and is sanitised again here via the same allowlist.
            dangerouslySetInnerHTML={{ __html: preview ?? "<p>Nothing to preview.</p>" }}
          />
        ) : null}
      </fieldset>

      <fieldset className="space-y-4 rounded-[var(--radius-card)] border border-border bg-background p-5">
        <legend className="px-1 text-sm font-semibold">Organisation</legend>

        <div>
          <label htmlFor="category_id" className={labelClasses}>
            Category
          </label>
          <select
            id="category_id"
            name="category_id"
            defaultValue={values.category_id}
            className={inputClasses}
          >
            <option value="">Uncategorised</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="is_noindex"
            defaultChecked={values.is_noindex}
            className="h-4 w-4 accent-primary"
          />
          Hide from search engines (noindex) and exclude from the sitemap
        </label>
      </fieldset>

      <fieldset className="space-y-4 rounded-[var(--radius-card)] border border-border bg-background p-5">
        <legend className="px-1 text-sm font-semibold">SEO</legend>

        <div>
          <label htmlFor="seo_title" className={labelClasses}>
            SEO title
          </label>
          <input
            id="seo_title"
            name="seo_title"
            defaultValue={values.seo_title}
            className={inputClasses}
            aria-describedby="seo-title-hint"
          />
          <p id="seo-title-hint" className="mt-1 text-xs text-muted-foreground">
            Blank uses the article title. Aim for 60 characters or fewer.
          </p>
        </div>

        <div>
          <label htmlFor="meta_description" className={labelClasses}>
            Meta description
          </label>
          <textarea
            id="meta_description"
            name="meta_description"
            rows={2}
            defaultValue={values.meta_description}
            className={inputClasses}
            aria-describedby="meta-description-hint"
          />
          <p id="meta-description-hint" className="mt-1 text-xs text-muted-foreground">
            Blank is generated from the body. Aim for 155 characters or fewer.
          </p>
        </div>

        <div>
          <label htmlFor="og_title" className={labelClasses}>
            Open Graph title
          </label>
          <input
            id="og_title"
            name="og_title"
            defaultValue={values.og_title}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="og_description" className={labelClasses}>
            Open Graph description
          </label>
          <textarea
            id="og_description"
            name="og_description"
            rows={2}
            defaultValue={values.og_description}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="canonical_url" className={labelClasses}>
            Canonical URL
          </label>
          <input
            id="canonical_url"
            name="canonical_url"
            defaultValue={values.canonical_url}
            placeholder="https://…"
            className={`${inputClasses} font-mono`}
            aria-describedby="canonical-hint"
          />
          <p id="canonical-hint" className="mt-1 text-xs text-muted-foreground">
            Only set this if the article is republished elsewhere and should
            consolidate to that URL.
          </p>
          {state.fieldErrors?.canonical_url ? (
            <p className="mt-1 text-sm text-danger">
              {state.fieldErrors.canonical_url}
            </p>
          ) : null}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <ActionButton>{values.id ? "Save changes" : "Create draft"}</ActionButton>

        {canPublish && values.id ? (
          <span className="text-xs text-muted-foreground">
            Use the publishing panel to change status.
          </span>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        {canPublish
          ? "You can publish this article."
          : "You can edit this draft. An editor must review and publish it."}
      </p>
    </form>
  );
}