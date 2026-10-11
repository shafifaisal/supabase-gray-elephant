import type { Metadata } from "next";

import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Media",
  robots: { index: false, follow: false },
};

interface MediaRow {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  visibility: "public" | "private";
  created_at: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function MediaPage() {
  await requireRole("author");

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("media")
    .select("id, filename, mime_type, size_bytes, width, height, alt_text, visibility, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const media = (data ?? []) as MediaRow[];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Media</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Uploaded assets, stored in Supabase Storage.
      </p>

      <div className="mt-6 rounded-[var(--radius-card)] border border-border bg-secondary/40 p-5">
        <h2 className="text-sm font-semibold">Upload</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          File uploads are wired to Supabase Storage and will be completed in a
          follow-up phase. Until then, add media by uploading to the{" "}
          <span className="font-mono">media</span> bucket and inserting a row
          into the <span className="font-mono">media</span> table.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Vercel functions have no persistent filesystem, so uploads must go to
          Storage rather than the local disk.
        </p>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error.message}
        </p>
      ) : null}

      {media.length === 0 ? (
        <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          No media uploaded yet.
        </p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((item) => (
            <li
              key={item.id}
              className="rounded-[var(--radius-card)] border border-border bg-background p-4"
            >
              <p className="truncate font-medium">{item.filename}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.mime_type} · {formatBytes(item.size_bytes)}
                {item.width && item.height ? ` · ${item.width}×${item.height}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.visibility} ·{" "}
                {formatDateTime(new Date(item.created_at))}
              </p>
              {item.alt_text ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Alt: {item.alt_text}
                </p>
              ) : (
                <p className="mt-1 text-xs text-warning">Missing alt text</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}