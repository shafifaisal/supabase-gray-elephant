import { randomUUID } from "node:crypto";

import { readRasterInfo, type RasterMime } from "@/lib/media/image-info";
import { mediaPublicUrl } from "@/lib/media/urls";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side validation and upload for an article's featured image.
 *
 * The browser check is a convenience; THIS is the authority. The declared MIME
 * type is not trusted — the bytes are inspected to confirm the file really is a
 * raster image of an accepted format, and its dimensions are read from the
 * header so distance limits cannot be dodged with a renamed file.
 */

/** Mirrors the `media` bucket limit in 0005_storage.sql. */
export const FEATURED_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const FEATURED_IMAGE_MIN_WIDTH = 600;
export const FEATURED_IMAGE_MIN_HEIGHT = 315;
export const FEATURED_IMAGE_MAX_DIMENSION = 8000;

/** Kept short enough to stay a useful, readable alt attribute. */
export const ALT_TEXT_MAX_LENGTH = 300;

/** Alt text should be a concise phrase; blank becomes NULL, never an empty string. */
export function normaliseAltText(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Accepted formats and the extension used for the stored object. */
const EXTENSION: Partial<Record<RasterMime, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export interface FeaturedImageRecord {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export type FeaturedImageResult =
  | { ok: true; image: FeaturedImageRecord }
  | { ok: false; error: string };

export async function uploadFeaturedImage(params: {
  userId: string;
  file: File;
  altText?: string | null;
  /**
   * Minimum accepted dimensions. Default to the featured-image floor; inline
   * body images pass a smaller floor because diagrams and icons are legitimately
   * narrow.
   */
  minWidth?: number;
  minHeight?: number;
}): Promise<FeaturedImageResult> {
  const { userId, file } = params;
  const minWidth = params.minWidth ?? FEATURED_IMAGE_MIN_WIDTH;
  const minHeight = params.minHeight ?? FEATURED_IMAGE_MIN_HEIGHT;

  if (file.size === 0) {
    return { ok: false, error: "The selected file is empty." };
  }
  if (file.size > FEATURED_IMAGE_MAX_BYTES) {
    return { ok: false, error: "Images must be 5 MB or smaller." };
  }

  const altText = normaliseAltText(params.altText);
  if (altText && altText.length > ALT_TEXT_MAX_LENGTH) {
    return {
      ok: false,
      error: `Alt text must be ${ALT_TEXT_MAX_LENGTH} characters or fewer.`,
    };
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const info = readRasterInfo(buffer);

  if (!info.mime) {
    return { ok: false, error: "That file is not a readable PNG, JPEG or WebP image." };
  }

  const extension = EXTENSION[info.mime];
  if (!extension) {
    return { ok: false, error: "Use a PNG, JPEG or WebP image." };
  }

  // The declared type may be missing or wrong; the real content wins.
  if (
    file.type &&
    file.type !== info.mime &&
    // Browsers report JPEG as image/jpeg; accept the equivalent spelling.
    !(file.type === "image/jpg" && info.mime === "image/jpeg")
  ) {
    return { ok: false, error: "The file content does not match its type." };
  }

  const { width, height } = info;
  if (!width || !height) {
    return { ok: false, error: "Could not read the image dimensions." };
  }
  if (width > FEATURED_IMAGE_MAX_DIMENSION || height > FEATURED_IMAGE_MAX_DIMENSION) {
    return {
      ok: false,
      error: `Images must be at most ${FEATURED_IMAGE_MAX_DIMENSION}×${FEATURED_IMAGE_MAX_DIMENSION} pixels.`,
    };
  }
  if (width < minWidth || height < minHeight) {
    return {
      ok: false,
      error: `Images must be at least ${minWidth}×${minHeight} pixels.`,
    };
  }

  const bucket = "media";
  const storagePath = `${userId}/${randomUUID()}.${extension}`;

  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType: info.mime, upsert: false });

  if (uploadError) {
    return { ok: false, error: `Upload failed: ${uploadError.message}` };
  }

  const filename = file.name.slice(0, 255);

  const { data, error: insertError } = await supabase
    .from("media")
    .insert({
      storage_path: storagePath,
      bucket,
      filename,
      mime_type: info.mime,
      size_bytes: file.size,
      width,
      height,
      alt_text: altText,
      visibility: "public",
      uploaded_by: userId,
    })
    .select("id")
    .single();

  if (insertError) {
    // Never leave an object behind that no row points at.
    await supabase.storage.from(bucket).remove([storagePath]);
    return { ok: false, error: `Could not save the image: ${insertError.message}` };
  }

  return {
    ok: true,
    image: {
      id: data.id,
      url: mediaPublicUrl(bucket, storagePath),
      width,
      height,
      altText,
      filename,
      mimeType: info.mime,
      sizeBytes: file.size,
    },
  };
}

/**
 * Updates the alt text on an existing media row.
 *
 * Caller must already be staff (the action checks the role); `media_staff_update`
 * enforces the same at the database. Blank clears the value to NULL.
 */
export async function updateFeaturedImageAlt(params: {
  mediaId: string;
  altText: string | null;
}): Promise<{ ok: true; altText: string | null } | { ok: false; error: string }> {
  const altText = normaliseAltText(params.altText);
  if (altText && altText.length > ALT_TEXT_MAX_LENGTH) {
    return {
      ok: false,
      error: `Alt text must be ${ALT_TEXT_MAX_LENGTH} characters or fewer.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("media")
    .update({ alt_text: altText })
    .eq("id", params.mediaId);

  if (error) {
    return { ok: false, error: "Could not save the alt text." };
  }

  return { ok: true, altText };
}

/**
 * Deletes a media row and its storage object when no article references it.
 *
 * Best effort: an author may lack the role needed to delete the object or the
 * row, in which case the reference is simply left for an admin to clear. This
 * never throws into the article save path.
 */
export async function cleanupUnusedMedia(mediaId: string): Promise<void> {
  try {
    const supabase = await createClient();

    const { count, error: refError } = await supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .or(`featured_image_id.eq.${mediaId},og_image_id.eq.${mediaId}`);

    if (refError || (count ?? 0) > 0) return;

    const { data: media } = await supabase
      .from("media")
      .select("bucket, storage_path")
      .eq("id", mediaId)
      .maybeSingle<{ bucket: string; storage_path: string }>();

    if (!media) return;

    await supabase.storage.from(media.bucket).remove([media.storage_path]);
    await supabase.from("media").delete().eq("id", mediaId);
  } catch {
    // Cleanup is opportunistic; a failure must never affect the save.
  }
}
