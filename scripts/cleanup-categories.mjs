/**
 * Removes leftover categories and tags created by test runs.
 *
 * The RLS verification scripts create categories named `rls-*`; cleaning them
 * keeps the public /guides/category index tidy.
 *
 * Usage: node --env-file=.env.local scripts/cleanup-categories.mjs
 */

import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: categories } = await admin
  .from("categories")
  .select("id, slug")
  .like("slug", "rls-%");

if (!categories || categories.length === 0) {
  console.log("No test categories to remove.");
} else {
  for (const category of categories) {
    await admin.from("categories").delete().eq("id", category.id);
    console.log(`Removed category ${category.slug}`);
  }
}

const { data: tags } = await admin.from("tags").select("id, slug").like("slug", "rls-%");

if (tags && tags.length > 0) {
  for (const tag of tags) {
    await admin.from("tags").delete().eq("id", tag.id);
  }
  console.log(`Removed ${tags.length} test tag(s).`);
}

const { data: remaining } = await admin
  .from("categories")
  .select("slug")
  .order("position");

console.log("Categories remaining:", remaining ?? []);