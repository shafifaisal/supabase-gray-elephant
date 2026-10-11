/**
 * End-to-end authentication + RLS verification against a real Supabase project.
 *
 * Creates real auth users with known roles, signs in as each of them, and
 * asserts that Row Level Security permits and denies the right operations.
 *
 * Requires SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.
 * Run against a TEST project, never production.
 *
 * Usage: node --env-file=.env.local scripts/verify-auth.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stamp = Date.now();
const USERS = {
  admin: `rls-admin-${stamp}@example.test`,
  editor: `rls-editor-${stamp}@example.test`,
  author: `rls-author-${stamp}@example.test`,
  outsider: `rls-outsider-${stamp}@example.test`,
};

const createdIds = [];
let passed = 0;
let failed = 0;

// Role actually assigned to each fixture account. The "outsider" scenario is
// simply an author who owns nothing, so it maps to the author role.
const ASSIGNED_ROLE = {
  admin: "admin",
  editor: "editor",
  author: "author",
  outsider: "author",
};

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function createUser(email, scenario) {
  const role = ASSIGNED_ROLE[scenario];

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "TestPassphrase!2345",
    email_confirm: true,
    user_metadata: { full_name: `RLS ${scenario}` },
  });

  if (error) throw new Error(`createUser(${scenario}): ${error.message}`);

  const userId = data.user.id;
  createdIds.push(userId);

  // Assign the role with the service role (bypasses RLS by design).
  if (role !== "author") {
    // The escalation guard correctly rejects non-admin clients, so role
    // assignment goes through the service-role-only set_profile_role().
    const { error: roleError } = await admin.rpc("set_profile_role", {
      _user_id: userId,
      _role: role,
    });
    if (roleError) throw new Error(`setRole(${scenario}): ${roleError.message}`);
  }

  return userId;
}

async function signIn(email) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await client.auth.signInWithPassword({
    email,
    password: "TestPassphrase!2345",
  });

  if (error) throw new Error(`signIn(${email}): ${error.message}`);
  return client;
}

async function main() {
  console.log("Creating test users...\n");

  const ids = {};
  for (const [role, email] of Object.entries(USERS)) {
    ids[role] = await createUser(email, role);
  }
  console.log("Users created.\n");

  // --- 1. Profile provisioning defaults everyone to author ---------------
  console.log("Profile provisioning:");
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, role")
    .in("id", Object.values(ids));

  for (const p of profiles ?? []) {
    const role = Object.entries(ids).find(([, id]) => id === p.id)?.[0];
    if (role === "admin" || role === "editor") {
      check(`${role} role applied`, p.role === role, `got ${p.role}`);
    } else {
      check("new users default to author", p.role === "author", `got ${p.role}`);
    }
  }

  // --- 2. Fixture data ---------------------------------------------------
  const { data: category } = await admin
    .from("categories")
    .insert({ slug: `rls-cat-${stamp}`, name: "RLS Test Category" })
    .select()
    .single();

  const { data: draftArticle } = await admin
    .from("articles")
    .insert({
      slug: `rls-draft-${stamp}`,
      title: "RLS Draft Article",
      body_md: "draft body",
      status: "draft",
      author_id: ids.author,
      category_id: category.id,
    })
    .select()
    .single();

  const { data: publishedArticle } = await admin
    .from("articles")
    .insert({
      slug: `rls-published-${stamp}`,
      title: "RLS Published Article",
      body_md: "published body",
      status: "published",
      published_at: new Date(Date.now() - 60_000).toISOString(),
      author_id: ids.editor,
      category_id: category.id,
    })
    .select()
    .single();

  const { data: futureArticle } = await admin
    .from("articles")
    .insert({
      slug: `rls-future-${stamp}`,
      title: "RLS Scheduled Future Article",
      body_md: "future body",
      status: "published",
      // Publishes in an hour: must NOT be publicly visible yet.
      published_at: new Date(Date.now() + 3_600_000).toISOString(),
      author_id: ids.editor,
    })
    .select()
    .single();

  const { data: noindexArticle } = await admin
    .from("articles")
    .insert({
      slug: `rls-noindex-${stamp}`,
      title: "RLS Noindex Article",
      body_md: "noindex body",
      status: "published",
      is_noindex: true,
      published_at: new Date(Date.now() - 60_000).toISOString(),
      author_id: ids.editor,
    })
    .select()
    .single();

  console.log("Fixtures created.\n");

  // --- 3. Anonymous access ----------------------------------------------
  console.log("Anonymous (anon key) access:");
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: anonArticles } = await anon.from("articles").select("slug");
  const anonSlugs = (anonArticles ?? []).map((a) => a.slug);

  check(
    "anon sees the published article",
    anonSlugs.includes(publishedArticle.slug),
  );
  check("anon cannot see the draft", !anonSlugs.includes(draftArticle.slug));
  check(
    "anon cannot see a future-dated article",
    !anonSlugs.includes(futureArticle.slug),
  );
  check(
    "anon cannot see a noindex article",
    !anonSlugs.includes(noindexArticle.slug),
  );

  const { error: anonInsert } = await anon.from("articles").insert({
    slug: `anon-attempt-${stamp}`,
    title: "Anon Attempt",
    body_md: "x",
  });
  check("anon cannot insert an article", Boolean(anonInsert), "insert succeeded");

  const { error: anonDelete } = await anon
    .from("articles")
    .delete()
    .eq("id", publishedArticle.id);
  check("anon cannot delete an article", Boolean(anonDelete), "delete succeeded");

  const { data: anonProfiles } = await anon.from("profiles").select("id");
  check("anon cannot read profiles", (anonProfiles ?? []).length === 0);

  const { data: anonAudit } = await anon.from("audit_logs").select("id");
  check("anon cannot read audit logs", (anonAudit ?? []).length === 0);

  const { data: anonContact } = await anon.from("contact_messages").select("id");
  check("anon cannot read contact messages", (anonContact ?? []).length === 0);

  // --- 4. Outsider (author with no relationship) -------------------------
  console.log("\nAuthor accessing another author's draft:");
  const outsider = await signIn(USERS.outsider);

  const { data: outsiderDraft } = await outsider
    .from("articles")
    .select("slug")
    .eq("id", draftArticle.id);
  check(
    "unrelated author cannot read another author's draft",
    (outsiderDraft ?? []).length === 0,
  );

  const { data: outsiderUpdated, error: outsiderUpdate } = await outsider
    .from("articles")
    .update({ title: "Hijacked" })
    .eq("id", draftArticle.id)
    .select("id,title");
  check(
    "unrelated author cannot update another author's draft",
    (outsiderUpdated ?? []).length === 0,
    `updated ${outsiderUpdated?.length ?? 0} row(s)`,
  );

  // Confirm the row genuinely still holds its original title.
  const { data: draftAfter } = await admin
    .from("articles")
    .select("title")
    .eq("id", draftArticle.id)
    .single();
  check(
    "draft title unchanged after unauthorised update",
    draftAfter.title !== "Hijacked",
    `title is now "${draftAfter.title}"`,
  );
  void outsiderUpdate;

  // --- 5. Author owns their draft ---------------------------------------
  console.log("\nAuthor editing their own draft:");
  const author = await signIn(USERS.author);

  const { data: ownDraft } = await author
    .from("articles")
    .select("id")
    .eq("id", draftArticle.id);
  check("author can read their own draft", (ownDraft ?? []).length === 1);

  const { data: updatedDraft, error: authorUpdate } = await author
    .from("articles")
    .update({ title: "RLS Draft Article (edited)" })
    .eq("id", draftArticle.id)
    .select();
  check(
    "author can edit their own draft",
    !authorUpdate && updatedDraft?.length === 1,
    authorUpdate?.message,
  );

  // Author must not be able to publish directly.
  const { data: authorPublish } = await author
    .from("articles")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", draftArticle.id)
    .select("status");
  check(
    "author cannot self-publish without editor rights",
    (authorPublish ?? []).length === 0,
    `author published their own draft (status=${authorPublish?.[0]?.status})`,
  );

  // Verify at the database level, not just via the filtered response.
  const { data: draftStatusNow } = await admin
    .from("articles")
    .select("status")
    .eq("id", draftArticle.id)
    .single();
  check(
    "draft is still unpublished in the database",
    draftStatusNow.status === "draft",
    `status is ${draftStatusNow.status}`,
  );

  // --- 6. Role escalation -------------------------------------------------
  console.log("\nRole escalation attempts:");
  const { data: selfPromoteRows } = await author
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", ids.author)
    .select("role");
  check(
    "author cannot promote themselves to admin",
    (selfPromoteRows ?? []).length === 0 &&
      (await admin
        .from("profiles")
        .select("role")
        .eq("id", ids.author)
        .single()).data?.role === "author",
    `role is now ${selfPromoteRows?.[0]?.role}`,
  );

  const { error: editorUserWrite } = await (await signIn(USERS.editor))
    .from("profiles")
    .insert({ id: ids.outsider, role: "admin" });
  check(
    "editor cannot insert an admin profile",
    Boolean(editorUserWrite),
    "insert succeeded",
  );

  // --- 7. Editor powers ---------------------------------------------------
  console.log("\nEditor capabilities:");
  const editor = await signIn(USERS.editor);

  const { data: editorAll } = await editor.from("articles").select("slug");
  const editorSlugs = (editorAll ?? []).map((a) => a.slug);
  check(
    "editor can see drafts",
    editorSlugs.includes(draftArticle.slug),
  );
  check(
    "editor can see noindex articles",
    editorSlugs.includes(noindexArticle.slug),
  );

  const { data: editorPublished, error: editorPublishError } = await editor
    .from("articles")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", draftArticle.id)
    .select("status");
  check(
    "editor can publish an article",
    !editorPublishError && editorPublished?.[0]?.status === "published",
    editorPublishError?.message,
  );

  const { error: editorCatWrite } = await editor.from("categories").insert({
    slug: `rls-editor-cat-${stamp}`,
    name: "Editor Category",
  });
  check("editor can create a category", !editorCatWrite, editorCatWrite?.message);

  const { data: settingsWrite, error: editorSettingsWrite } = await editor
    .from("site_settings")
    .update({ value: { brand: "hijacked" } })
    .eq("key", "brand_name")
    .select("key");
  check(
    "editor cannot modify site settings",
    (settingsWrite ?? []).length === 0,
    `editor updated ${settingsWrite?.length ?? 0} setting(s)`,
  );
  void editorSettingsWrite;

  // --- 8. Revisions are append-only --------------------------------------
  console.log("\nRevision immutability:");
  const { data: revision } = await editor
    .from("article_revisions")
    .insert({
      article_id: draftArticle.id,
      revision_number: 1,
      title: "Revision 1",
      body_md: "v1",
      changed_by: ids.editor,
    })
    .select()
    .single();

  const { error: revisionUpdate } = await editor
    .from("article_revisions")
    .update({ title: "Tampered" })
    .eq("id", revision.id);
  check("revisions cannot be updated", Boolean(revisionUpdate), "update succeeded");

  const { error: revisionDelete } = await editor
    .from("article_revisions")
    .delete()
    .eq("id", revision.id);
  check("revisions cannot be deleted", Boolean(revisionDelete), "delete succeeded");

  const { data: anonRevisions } = await anon.from("article_revisions").select("id");
  check("anon cannot read revisions", (anonRevisions ?? []).length === 0);

  // --- 9. Audit logs ------------------------------------------------------
  console.log("\nAudit log access:");
  const { data: editorAudit } = await editor.from("audit_logs").select("id");
  check(
    "editor cannot read audit logs",
    (editorAudit ?? []).length === 0,
    "editor read audit logs",
  );

  const adminClient = await signIn(USERS.admin);
  const { data: adminAudit } = await adminClient.from("audit_logs").select("id");
  check(
    "admin can read audit logs",
    Array.isArray(adminAudit),
  );

  const { error: auditDelete } = await adminClient.from("audit_logs").delete();
  check("audit logs cannot be deleted", Boolean(auditDelete), "delete succeeded");

  // --- 10. Contact submissions --------------------------------------------
  console.log("\nContact submissions:");
  const { error: contactInsert } = await anon.from("contact_messages").insert({
    name: "Visitor",
    email: "visitor@example.test",
    subject: "Hello",
    message: "This is a test message from the RLS verification script.",
  });
  check(
    "anon can submit a contact message",
    !contactInsert,
    contactInsert?.message,
  );

  const { data: anonReadAfter } = await anon.from("contact_messages").select("id");
  check(
    "anon still cannot read contact messages back",
    (anonReadAfter ?? []).length === 0,
  );

  // --- 11. Admin user management -----------------------------------------
  console.log("\nAdmin user management:");
  const { error: adminRoleChange } = await adminClient
    .from("profiles")
    .update({ role: "editor" })
    .eq("id", ids.outsider);
  check(
    "admin can promote a user",
    !adminRoleChange,
    adminRoleChange?.message,
  );

  const { data: suspendAttempt } = await outsider
    .from("profiles")
    .update({ status: "suspended" })
    .eq("id", ids.admin)
    .select("status");
  check(
    "author cannot suspend an admin",
    (suspendAttempt ?? []).length === 0,
    `suspension updated ${suspendAttempt?.length ?? 0} row(s)`,
  );

  // Escalation attempt: author promoting themselves via a direct update.
  const { data: lateSelfPromoteRows } = await author
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", ids.author)
    .select("role");
  check(
    "author cannot self-promote to admin via direct update",
    (lateSelfPromoteRows ?? []).length === 0,
    `role changed to ${lateSelfPromoteRows?.[0]?.role}`,
  );

  const { data: roleAfter } = await admin
    .from("profiles")
    .select("role")
    .eq("id", ids.author)
    .single();
  check(
    "author role unchanged in the database",
    roleAfter.role === "author",
    `role is ${roleAfter.role}`,
  );

  // --- Cleanup -------------------------------------------------------------
  console.log("\nCleaning up test data...");
  await admin
    .from("articles")
    .delete()
    .in("id", [draftArticle.id, publishedArticle.id, futureArticle.id, noindexArticle.id]);
  await admin.from("categories").delete().eq("id", category.id);
  await admin
    .from("contact_messages")
    .delete()
    .eq("email", "visitor@example.test");

  for (const id of createdIds) {
    await admin.auth.admin.deleteUser(id);
  }
  console.log("Cleanup complete.");

  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});