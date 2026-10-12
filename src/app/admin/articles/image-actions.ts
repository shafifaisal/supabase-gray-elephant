"use server";

import { requireRole } from "@/lib/auth/session";
import {
  updateFeaturedImageAlt,
  uploadFeaturedImage,
  type FeaturedImageRecord,
} from "@/lib/media/featured-image";
import { createClient } from "@/lib/supabase/server";

export interface ArticleImageUploadState {
  ok: boolean;
  error?: string;
  image?: FeaturedImageRecord;
}

export interface ArticleImageAltState {
  ok: boolean;
  error?: string;
  altText?: string | null;
}

/**
 * Uploads a featured image for an article from the editor.
 *
 * Authorized and validated on the server: the caller must be staff, and the
 * actual file content is inspected rather than trusting the browser's declared
 * type. Returns the stored media record so the editor can preview it before the
 * article itself is saved.
 */
export async function uploadArticleImageAction(
  _prev: ArticleImageUploadState | null,
  formData: FormData,
): Promise<ArticleImageUploadState> {
  const user = await requireRole("author");

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image to upload." };
  }

  const altText = formData.get("altText");
  const result = await uploadFeaturedImage({
    userId: user.id,
    file,
    altText: typeof altText === "string" ? altText : null,
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  try {
    const supabase = await createClient();
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "media.uploaded",
      entity_type: "media",
      entity_id: result.image.id,
      after_state: {
        filename: result.image.filename,
        mime_type: result.image.mimeType,
        size_bytes: result.image.sizeBytes,
        source: "article.featured_image",
      },
    });
  } catch {
    // Auditing must never fail the upload the user just completed.
  }

  return { ok: true, image: result.image };
}

/**
 * Uploads an image for use inside the rich text editor's article body.
 *
 * Same server-side authority as the featured-image upload (staff role, byte
 * inspection, type and size limits) but with a lower minimum dimension, since
 * inline diagrams and icons are legitimately narrow. Returns the public media
 * URL so the editor can insert an <img> immediately.
 */
export async function uploadArticleBodyImageAction(
  _prev: ArticleImageUploadState | null,
  formData: FormData,
): Promise<ArticleImageUploadState> {
  const user = await requireRole("author");

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image to upload." };
  }

  const altText = formData.get("altText");
  const result = await uploadFeaturedImage({
    userId: user.id,
    file,
    altText: typeof altText === "string" ? altText : null,
    minWidth: BODY_IMAGE_MIN_DIMENSION,
    minHeight: BODY_IMAGE_MIN_DIMENSION,
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  try {
    const supabase = await createClient();
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "media.uploaded",
      entity_type: "media",
      entity_id: result.image.id,
      after_state: {
        filename: result.image.filename,
        mime_type: result.image.mimeType,
        size_bytes: result.image.sizeBytes,
        source: "article.body_image",
      },
    });
  } catch {
    // Auditing must never fail the upload the user just completed.
  }

  return { ok: true, image: result.image };
}

/** Smallest inline image we accept, to reject tracking pixels and blanks. */
const BODY_IMAGE_MIN_DIMENSION = 16;

/**
 * Saves the alt text for an already-uploaded image, so editors can describe it
 * (for search engines and screen readers) after choosing the file.
 */
export async function updateArticleImageAltAction(
  mediaId: string,
  altText: string,
): Promise<ArticleImageAltState> {
  await requireRole("author");

  if (!mediaId) {
    return { ok: false, error: "There is no image to update." };
  }

  const result = await updateFeaturedImageAlt({ mediaId, altText });
  return result.ok
    ? { ok: true, altText: result.altText }
    : { ok: false, error: result.error };
}
