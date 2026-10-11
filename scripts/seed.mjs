/**
 * Seeds a category and a small set of ORIGINAL draft articles.
 *
 * IMPORTANT
 * ---------
 * These are real, original drafts created to exercise the publishing workflow
 * end to end. They are created as `draft` and must be reviewed and published
 * through the admin panel — nothing is auto-published.
 *
 * Content is original to this project. Nothing is copied from any other site.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed.mjs
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!url || !serviceKey) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CATEGORY = {
  slug: "password-basics",
  name: "Password basics",
  description:
    "Practical fundamentals: length, randomness, reuse and storage.",
  position: 1,
};

const ARTICLES = [
  {
    slug: "why-password-length-beats-complexity",
    title: "Why password length beats complexity",
    category: "password-basics",
    excerpt:
      "Length adds strength faster than symbols do, and it is far easier to get right. Here is the arithmetic.",
    tags: ["length", "basics"],
    seo_title: "Why password length beats complexity",
    meta_description:
      "Doubling a password's length beats adding a symbol. A short walkthrough of the entropy maths and why length is the easier win.",
    body_md: `Adding a symbol to a password feels like a big improvement. In practice it is a rounding error, and length is the variable that actually moves the needle.

## The arithmetic

Entropy is measured in bits: how much guessing an attacker has to do. For a password of length L drawn from a pool of N possible characters, the entropy is:

\`\`\`
H = L x log2(N)
\`\`\`

Take a common 8-character password using the 94 printable ASCII characters, which is a pool of about 6.55 bits per character:

\`\`\`
8 x log2(94) = 8 x 6.55 = 52.4 bits
\`\`\`

Now extend it to 16 characters, which is still a perfectly memorable length:

\`\`\`
16 x log2(94) = 16 x 6.55 = 104.8 bits
\`\`\`

Doubling the length doubled the strength. Compare that with keeping 8 characters and adding the full set of symbols — which is what that pool of 94 already assumed. There is no headroom left to add.

## Why length wins

The reason is that every character multiplies the work. Adding one character multiplies the search space by N. Widening the pool from letters-only to letters-plus-symbols changes \`log2(N)\` from 4.7 to 6.5 — a useful gain, but a single multiplication, not a doubling.

The practical advice follows directly:

- **Prefer length.** Four extra characters beat any symbol substitution.
- **Do not sacrifice length for complexity.** A password manager removes the need to remember complexity rules.
- **Avoid forced rotation.** Regular forced changes push people towards predictable patterns like \`Password1!\`, which are widely known.

## The one caveat

Length only helps if the password is still random. \`aaaaaaaaaaaaaaaaaaaa\` is long and worthless. Length and randomness are separate properties, and a good password has both.

If you want the arithmetic for a specific case, the [entropy calculator](/password-entropy-calculator) shows the working.`,
  },
  {
    slug: "how-password-reuse-happens",
    title: "How password reuse happens, and how to stop it",
    category: "password-basics",
    excerpt:
      "Reuse is the single biggest cause of account compromise. It is also the easiest to fix, if you have the right tool.",
    tags: ["reuse", "managers"],
    seo_title: "How password reuse happens, and how to stop it",
    meta_description:
      "Credential stuffing turns one leaked password into many compromised accounts. Here is why reuse happens and how a password manager removes the habit.",
    body_md: `Every major breach of the last decade has one thing in common: the passwords that leaked were already known. Attackers take those lists and try them against other services automatically.

## What credential stuffing looks like

An attacker does not need to break your password. They take a list of a billion email and password pairs and replay them against a hundred different services. This is called credential stuffing, and it costs almost nothing to run.

If you used the same password on three sites and it leaked from one, the odds are that all three are now in someone else's hands. The site that leaked was not hacked in any clever way. It simply already had the key.

## Why people reuse

The honest answer is that reuse is a rational response to bad tooling. Remembering twelve distinct passwords is genuinely hard, and sites actively discourage password managers by blocking paste into the password field or refusing non-alphanumeric characters.

## What actually fixes it

A password manager removes the decision entirely. You remember one strong master password, and the manager generates and stores a unique password for every other site.

Three things make adoption realistic:

1. **Start with the accounts that matter.** Email first. Your email address is the reset route for everything else, so an attacker who gets into your inbox gets everything.
2. **Let the manager generate passwords.** Do not invent them yourself. The value is in the uniqueness, and generation gets that for free.
3. **Turn on two-factor authentication** while you work through the list. It limits the damage from any password that does leak.

You do not need to do this in one sitting. Replacing one reused password a week fixes the problem faster than intending to replace all of them at once.

## What reuse cannot fix

If a password is already in a breach corpus, making a new account with it changes nothing. Change the password on the account that is already exposed, and change it everywhere you reused it.`,
  },
  {
    slug: "reading-a-strength-meter-honestly",
    title: "Reading a strength meter honestly",
    category: "password-basics",
    excerpt:
      "A strength score is an estimate with real limitations. Knowing what it measures stops it misleading you.",
    tags: ["strength", "entropy"],
    seo_title: "Reading a password strength meter honestly",
    meta_description:
      "What strength meters actually measure, where they mislead, and why the score is not a guarantee of safety.",
    body_md: `Every password field wants to tell you how strong your password is. Some of those meters are better than others, and none of them is a guarantee.

## What a good meter measures

A serious strength estimate does more than count character types. It compares your password against:

- Lists of common passwords leaked in real breaches
- Dictionary words, including names and common English
- Keyboard walks like \`qwerty\` and \`asdfgh\`
- Repeated characters and sequences like \`aaaa\` or \`1234\`
- Substitutions, so \`p@ssw0rd\` is recognised as \`password\`

That is what the [strength checker](/password-strength-checker) on this site does, using the zxcvbn algorithm. It also reports an estimate in bits, which is more meaningful than a coloured bar.

## The honest limitations

Three things no meter can tell you:

**Whether you reused it.** A strength estimate is about the string, not about your accounts. A unique 40-bit password protecting your email is worse than a unique 80-bit one.

**Whether it has already leaked.** If your password is in a corpus an attacker already holds, its mathematical strength is irrelevant. They do not need to guess.

**Whether the site stores it safely.** A strong password on a site that stores it in plaintext, or reuses it as an encryption key, is still compromised.

## Treat the score as one signal

A score of 4 out of 4 means the string is hard to guess from the string alone. It is not permission to be complacent. The strongest password on a service you reuse everywhere is still a liability, because one breach exposes it once.

Use the score to avoid obviously weak passwords. Use a password manager and a second factor to fix the risks the score cannot see.`,
  },
];

/** Minimal Markdown to HTML for seed content. Replaced by the app on save. */
function toHtml(markdown) {
  return markdown
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\n\n/g, "\n")
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<h[23]>/.test(trimmed)) return trimmed;
      if (/^```/.test(trimmed)) {
        return `<pre><code>${trimmed.replace(/^```\w*\n?/, "").replace(/```$/, "")}</code></pre>`;
      }
      return `<p>${trimmed.replace(/\n/g, " ")}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

async function main() {
  console.log("Seeding categories and draft articles...\n");

  const { data: category, error: categoryError } = await admin
    .from("categories")
    .upsert(CATEGORY, { onConflict: "slug" })
    .select("id, slug")
    .single();

  if (categoryError) throw categoryError;
  console.log(`Category ready: ${category.slug}`);

  // Ensure the tag rows exist.
  const allTags = [...new Set(ARTICLES.flatMap((a) => a.tags))];
  for (const tag of allTags) {
    await admin
      .from("tags")
      .upsert({ name: tag, slug: tag }, { onConflict: "slug" });
  }
  console.log(`Tags ready: ${allTags.join(", ")}`);

  for (const article of ARTICLES) {
    const { data: existing } = await admin
      .from("articles")
      .select("id")
      .eq("slug", article.slug)
      .maybeSingle();

    if (existing) {
      console.log(`  skip  ${article.slug} (already exists)`);
      continue;
    }

    const { error } = await admin.from("articles").insert({
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      body_md: article.body_md,
      body_html: toHtml(article.body_md),
      status: "draft",
      category_id: category.id,
      seo_title: article.seo_title,
      meta_description: article.meta_description,
    });

    if (error) throw error;
    console.log(`  draft ${article.slug}`);
  }

  console.log("\nDone. All articles are DRAFTS.");
  console.log("Sign in at /admin, review them, then publish.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});