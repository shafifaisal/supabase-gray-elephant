import type { Metadata } from "next";

import { CategoryManager } from "@/components/admin/category-manager";
import { requireRole } from "@/lib/auth/session";
import { getCategories } from "@/lib/content/articles";

import { createCategoryAction } from "./actions";

export const metadata: Metadata = {
  title: "Categories",
  robots: { index: false, follow: false },
};

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  await requireRole("editor");
  const { deleted } = await searchParams;
  const categories = await getCategories();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Categories are public. Deleting one leaves its articles intact but
        uncategorised.
      </p>

      {deleted ? (
        <p
          role="status"
          className="mt-4 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
        >
          Category deleted.
        </p>
      ) : null}

      <CategoryManager
        action={createCategoryAction}
        categories={categories}
      />
    </div>
  );
}