import type { Metadata } from "next";

import { TagManager } from "@/components/admin/tag-manager";
import { requireRole } from "@/lib/auth/session";
import { getTags } from "@/lib/content/articles";

import { createTagAction } from "./actions";

export const metadata: Metadata = {
  title: "Tags",
  robots: { index: false, follow: false },
};

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  await requireRole("editor");
  const { deleted } = await searchParams;
  const tags = await getTags();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Tags</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tags are public. Deleting one removes it from any articles that use it.
      </p>

      {deleted ? (
        <p
          role="status"
          className="mt-4 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
        >
          Tag deleted.
        </p>
      ) : null}

      <TagManager action={createTagAction} tags={tags} />
    </div>
  );
}
