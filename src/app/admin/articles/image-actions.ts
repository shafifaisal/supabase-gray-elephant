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
