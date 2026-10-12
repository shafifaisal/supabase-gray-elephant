import type { Metadata } from "next";

import { ArticleEditor } from "@/components/admin/article-editor";
import { roleAtLeast, requireRole } from "@/lib/auth/session";
import { getCategories } from "@/lib/content/articles";

import { createArticleAction } from "../actions";

export const metadata: Metadata = {
  title: "New article",
  robots: { index: false, follow: false },
};

export default async function NewArticlePage() {
  const user = await requireRole("author");
  const categories = await getCategories();

  return (
    <ArticleEditor
      action={createArticleAction}
      canPublish={roleAtLeast(user.role, "editor")}
      status="draft"
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      values={{
        title: "",
        slug: "",
        excerpt: "",
        body_md: "",
        category_id: "",
        seo_title: "",
        meta_description: "",
        og_title: "",
        og_description: "",
        canonical_url: "",
        is_noindex: false,
        featured_image_id: "",
      }}
    />
  );
}