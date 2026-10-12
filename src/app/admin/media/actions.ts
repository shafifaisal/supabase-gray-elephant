"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/validation/article";

/** Mirrors the bucket limits in supabase/migrations/0005_storage.sql. */
const MAX_BYTES = 5 * 1024 * 1024;

const MIME_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};

/** The private bucket deliberately excludes SVG uploads. */
const PUBLIC_ONLY_MIME = new Set(["image/svg+xml"]);

/**
 * Uploads a media asset to Supabase Storage and records its metadata.
 *
 * Vercel functions have no persistent filesystem, so the binary is written to
 * the `media` (or `media-private`) bucket. The object path is prefixed with the
 * uploader's id so the storage policies can confine each staff member to their
 * own folder.
 */
export async function uploadMediaAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("author");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { fieldErrors: { file: "Choose a file to upload" } };
  }

  if (file.size > MAX_BYTES) {
    return { fieldErrors: { file: "File must be 5 MB or smaller" } };
  }

  const extension = MIME_EXTENSION[file.type];
  if (!extension) {
    return {
      fieldErrors: { file: "Unsupported file type (PNG, JPEG, WebP, AVIF, SVG or GIF)" },
    };
  }

  const visibility = formData.get("visibility") === "private" ? "private" : "public";
  if (visibility === "private" && PUBLIC_ONLY_MIME.has(file.type)) {
    return { fieldErrors: { file: "SVG files can only be uploaded as public media" } };
  }

  const bucket = visibility === "private" ? "media-private" : "media";
  const storagePath = `${user.id}/${randomUUID()}.${extension}`;

  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return { error: `Upload failed: ${uploadError.message}` };
  }

  const altText = String(formData.get("alt_text") ?? "").trim();
  const filename = file.name.slice(0, 255);

  const { data, error: insertError } = await supabase
    .from("media")
    .insert({
      storage_path: storagePath,
      bucket,
      filename,
      mime_type: file.type,
      size_bytes: file.size,
      alt_text: altText || null,
      visibility,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (insertError) {
    // Do not leave an orphaned object behind when the metadata write fails.
    await supabase.storage.from(bucket).remove([storagePath]);
    return { error: `Could not save media metadata: ${insertError.message}` };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "media.uploaded",
    entity_type: "media",
    entity_id: data.id,
    after_state: { filename, bucket, visibility, size_bytes: file.size },
  });

  revalidatePath("/admin/media");

  return { success: true };
}
