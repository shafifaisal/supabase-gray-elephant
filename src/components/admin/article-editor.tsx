"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { ActionButton } from "@/components/admin/action-button";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { ArticleThumbnail } from "@/components/articles/article-thumbnail";
import { slugifyTitle } from "@/lib/format";
import { MAX_BODY_LENGTH, type ActionState } from "@/lib/validation/article";

import { uploadArticleImageAction, updateArticleImageAltAction } from "@/app/admin/articles/image-actions";

/** The featured image currently attached to the article being edited. */
export interface FeaturedImageValue {
  id: string;
  /** Null when the media row is not publicly readable (e.g. a private asset). */
  url: string | null;
  width: number | null;
  height: number | null;
  alt: string | null;
}

/** Client-side pre-checks; the server repeats and is the authority. */
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIN_IMAGE_WIDTH = 600;
const MIN_IMAGE_HEIGHT = 315;
const MAX_IMAGE_DIMENSION = 8000;

async function validateImageFile(file: File): Promise<string | null> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Use a PNG, JPEG or WebP image.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Images must be 5 MB or smaller.";
  }

  try {
    const objectUrl = URL.createObjectURL(file);
    const dimensions = await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        const img = new window.Image();
        img.onload = () =>
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error("Could not decode the image"));
        img.src = objectUrl;
      },
    ).finally(() => URL.revokeObjectURL(objectUrl));

    if (dimensions.width < MIN_IMAGE_WIDTH || dimensions.height < MIN_IMAGE_HEIGHT) {
      return `Images must be at least ${MIN_IMAGE_WIDTH}×${MIN_IMAGE_HEIGHT} pixels.`;
    }
    if (
      dimensions.width > MAX_IMAGE_DIMENSION ||
      dimensions.height > MAX_IMAGE_DIMENSION
    ) {
      return `Images must be at most ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION} pixels.`;
    }
  } catch {
    return "That file could not be read as an image.";
  }

  return null;
}

export interface ArticleFormValues {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  /**
   * Initial body as sanitised HTML. For legacy Markdown articles the caller
   * renders the Markdown to HTML first, so the visual editor always receives
   * HTML. Saving it records `body_format = 'html'`.
   */
  body_html: string;
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
 * Article editor with a visual (WYSIWYG) rich text body and a preview.
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
  featuredImage = null,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values: ArticleFormValues;
  categories: { id: string; name: string }[];
  canPublish: boolean;
  status: string;
  featuredImage?: FeaturedImageValue | null;
}) {
  const [state, formAction] = useActionState(action, {});
  const [body, setBody] = useState(values.body_html);
  const [preview, setPreview] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [slug, setSlug] = useState(values.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(values.slug));
  const [title, setTitle] = useState(values.title);
  const [image, setImage] = useState<FeaturedImageValue | null>(featuredImage);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageAlt, setImageAlt] = useState(featuredImage?.alt ?? "");
  const [altSaving, setAltSaving] = useState(false);
  const [altStatus, setAltStatus] = useState<"idle" | "saved" | "error">("idle");
  const savedAltRef = useRef(featuredImage?.alt ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          body: body.slice(0, MAX_BODY_LENGTH),
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
      setSlug(slugifyTitle(value));
    }
  }

  async function onImageSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset the native input so re-selecting the same file still fires change.
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    setImageError(null);

    const clientError = await validateImageFile(file);
    if (clientError) {
      setImageError(clientError);
      return;
    }

    const formData = new FormData();
    formData.set("image", file);
    formData.set("altText", imageAlt);

    setImageUploading(true);
    try {
      const result = await uploadArticleImageAction(null, formData);
      if (result.ok && result.image) {
        const uploadedAlt = result.image.altText ?? "";
        setImage({
          id: result.image.id,
          url: result.image.url,
          width: result.image.width,
          height: result.image.height,
          alt: result.image.altText,
        });
        setImageAlt(uploadedAlt);
        savedAltRef.current = uploadedAlt;
        setAltStatus("idle");
      } else {
        setImageError(result.error ?? "Upload failed.");
      }
    } catch {
      setImageError("Upload failed. Check your connection and try again.");
    } finally {
      setImageUploading(false);
    }
  }

  async function onAltBlur() {
    if (!image) return;

    const next = imageAlt.trim();
    if (next === savedAltRef.current.trim()) return;

    setAltSaving(true);
    setAltStatus("idle");
    try {
      const result = await updateArticleImageAltAction(image.id, next);
      if (result.ok) {
        const saved = result.altText ?? "";
        savedAltRef.current = saved;
        setImageAlt(saved);
        setImage((current) => (current ? { ...current, alt: saved || null } : current));
        setAltStatus("saved");
      } else {
        setAltStatus("error");
      }
    } catch {
      setAltStatus("error");
    } finally {
      setAltSaving(false);
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

      <fieldset className="space-y-4 rounded-[var(--radius-card)] border border-border bg-background p-9">
        <legend className="sr-only">Content</legend>

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
          <label htmlFor="body_html" className={labelClasses}>
            Body
          </label>
          {/* The editor serialises sanitised HTML into `body_html`; the server is
              still the authority and sanitises it again before storage. */}
          <input type="hidden" name="body_format" value="html" />
          <RichTextEditor
            name="body_html"
            defaultValue={values.body_html}
            describedBy="body-hint"
            onHtmlChange={setBody}
          />
          <p id="body-hint" className="mt-1 text-xs text-muted-foreground">
            Use the toolbar to format text, add headings, lists, links, images
            and tables. Formatting is cleaned and made safe when you save.
          </p>
          {state.fieldErrors?.body_html ? (
            <p className="mt-1 text-sm text-danger">{state.fieldErrors.body_html}</p>
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

      <fieldset className="space-y-4 rounded-[var(--radius-card)] border border-border bg-background p-9">
        <legend className="sr-only">Organisation</legend>

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

      <fieldset className="space-y-4 rounded-[var(--radius-card)] border border-border bg-background p-9">
        <legend className="sr-only">Featured image</legend>

        {/* The stored reference. Empty means no featured image. */}
        <input type="hidden" name="featured_image_id" value={image?.id ?? ""} />

        <div className="max-w-md">
          <ArticleThumbnail
            image={
              image && image.url
                ? {
                    id: image.id,
                    url: image.url,
                    alt: image.alt,
                    width: image.width,
                    height: image.height,
                  }
                : null
            }
            title={title || "Featured image preview"}
            sizes="(min-width: 640px) 28rem, 100vw"
            className="rounded-md border border-border"
          />
        </div>

        <div>
          <label htmlFor="featured_image" className={labelClasses}>
            Image
          </label>
          <input
            ref={fileInputRef}
            id="featured_image"
            name="featured_image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={imageUploading}
            onChange={onImageSelected}
            className={`${inputClasses} file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:font-semibold`}
            aria-describedby="featured-image-hint"
          />
          <p id="featured-image-hint" className="mt-1 text-xs text-muted-foreground">
            PNG, JPEG or WebP · at least {MIN_IMAGE_WIDTH}×{MIN_IMAGE_HEIGHT} · up
            to 5 MB. Shown as the article thumbnail and in social previews.
            Choosing a new file replaces the current image.
          </p>
        </div>

        {image ? (
          <div>
            <label htmlFor="featured_image_alt" className={labelClasses}>
              Alt text
            </label>
            <input
              id="featured_image_alt"
              name="featured_image_alt"
              value={imageAlt}
              maxLength={300}
              onChange={(event) => {
                setImageAlt(event.target.value);
                if (altStatus !== "idle") setAltStatus("idle");
              }}
              onBlur={onAltBlur}
              disabled={altSaving}
              placeholder="Describe the image for search engines and screen readers"
              className={inputClasses}
              aria-describedby="featured-image-alt-hint"
            />
            <p
              id="featured-image-alt-hint"
              className="mt-1 text-xs text-muted-foreground"
            >
              {altStatus === "saved"
                ? "Alt text saved."
                : altStatus === "error"
                  ? "Could not save the alt text. Try again."
                  : "Blank uses the article title. Describe what the image shows; avoid keyword lists."}
            </p>
          </div>
        ) : null}

        {imageUploading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Uploading…
          </p>
        ) : null}

        {imageError ? (
          <p role="alert" className="text-sm text-danger">
            {imageError}
          </p>
        ) : null}

        {image && !image.url ? (
          <p className="text-sm text-warning">
            The current image is not publicly available and will not display.
            Upload a replacement.
          </p>
        ) : null}

        {image ? (
          <button
            type="button"
            onClick={() => {
              setImage(null);
              setImageError(null);
              setImageAlt("");
              savedAltRef.current = "";
              setAltStatus("idle");
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="h-10 rounded-md border border-danger/50 px-4 text-sm font-semibold text-danger transition-colors hover:bg-danger/10"
          >
            Remove image
          </button>
        ) : null}
      </fieldset>

      <fieldset className="space-y-4 rounded-[var(--radius-card)] border border-border bg-background p-9">
        <legend className="sr-only">SEO</legend>

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
        <ActionButton
          name="intent"
          value="save"
          variant={canPublish && status !== "published" ? "ghost" : "primary"}
        >
          {values.id ? "Save changes" : "Create draft"}
        </ActionButton>

        {canPublish && status !== "published" ? (
          <ActionButton name="intent" value="publish">Save and publish</ActionButton>
        ) : null}

        {canPublish && values.id ? (
          <span className="text-xs text-muted-foreground">
            Publishing, scheduling and archiving are also available below.
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