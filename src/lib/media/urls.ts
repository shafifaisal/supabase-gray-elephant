/**
 * Helpers for turning a `media` row into a public, absolute URL.
 *
 * Featured images live in the public `media` bucket, so their objects are
 * served directly by Supabase Storage at a stable, deployment-independent URL.
 * The URL is built from `NEXT_PUBLIC_SUPABASE_URL`, which is the same value in
 * every environment, so a stored image keeps working after a redeploy.
 */

import { createBuildClient } from "@/lib/supabase/build";

export interface PublicMedia {
  id: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
}

/** Builds the absolute public URL for an object in a public bucket. */
export function mediaPublicUrl(bucket: string, storagePath: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  // Each path segment is encoded, but the separators are preserved.
  const encodedPath = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${base}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

/**
 * Resolves a set of media ids to public URLs.
 *
 * Read with the cookie-free anon client, so Row Level Security applies: only
 * `visibility = 'public'` assets in the public bucket come back. An unreachable
 * database degrades to an empty map — a listing page must still render.
 */
export async function getPublicMediaMap(
  ids: (string | null | undefined)[],
): Promise<Map<string, PublicMedia>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, PublicMedia>();

  if (unique.length === 0) return map;

  try {
    const supabase = createBuildClient();

    const { data, error } = await supabase
      .from("media")
      .select("id, storage_path, bucket, alt_text, width, height, visibility")
      .in("id", unique)
      .eq("visibility", "public")
      .eq("bucket", "media");

    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      map.set(row.id, {
        id: row.id,
        url: mediaPublicUrl(row.bucket, row.storage_path),
        alt: row.alt_text,
        width: row.width,
        height: row.height,
      });
    }
  } catch (error) {
    console.error(
      "[media] Failed to resolve public media; listings render without images.",
      error,
    );
  }

  return map;
}
