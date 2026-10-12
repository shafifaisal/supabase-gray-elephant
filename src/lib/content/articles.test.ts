import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `server-only` throws outside a React Server Component render, so it is mocked
 * away for these pure-logic unit tests. The module under test is still a server
 * module; only the import guard is neutralised here.
 */
vi.mock("server-only", () => ({}));

const fromMock = vi.fn();

vi.mock("@/lib/supabase/build", () => ({
  createBuildClient: () => ({ from: fromMock }),
}));

// The admin getters use the request-scoped client, which reads `next/headers`.
// Replacing the whole module keeps that out of the test environment.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

import {
  getArticlesByCategory,
  getCategories,
  getPublicCategories,
  getPublishedArticleBySlug,
  getPublishedArticles,
  getPublishedSlugsLive,
  getRelatedArticles,
} from "@/lib/content/articles";

const ROW = { id: "a1", slug: "a-guide", title: "A guide" };

interface QueryResult {
  data: unknown;
  error: unknown;
}

/**
 * Minimal stand-in for a PostgREST query chain.
 *
 * The chain is also a thenable, matching the real builder, so `await` on the
 * builder without `.maybeSingle()` resolves like Supabase does.
 */
function makeChain(result: QueryResult) {
  const chain: Record<string, unknown> = {};

  for (const method of ["select", "eq", "neq", "order", "limit"]) {
    chain[method] = vi.fn(() => chain);
  }

  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.then = (onFulfilled: (value: QueryResult) => unknown) =>
    Promise.resolve(result).then(onFulfilled);

  return chain;
}

function mockQuery(result: QueryResult) {
  const chain = makeChain(result);
  fromMock.mockReturnValue(chain);
  return chain;
}

const TABLE_MISSING = {
  message: "Could not find the table 'public.articles' in the schema cache",
};

describe("public reads fail soft", () => {
  beforeEach(() => {
    fromMock.mockReset();
    // Failing softly is expected here, but the error must still be logged.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns rows when the query succeeds", async () => {
    mockQuery({ data: [ROW], error: null });
    expect(await getPublishedArticles()).toEqual([ROW]);
  });

  it("returns an empty list when the query errors", async () => {
    mockQuery({ data: null, error: TABLE_MISSING });
    expect(await getPublishedArticles()).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it("returns an empty list when the client itself throws", async () => {
    fromMock.mockImplementation(() => {
      throw new Error("network down");
    });
    expect(await getPublishedArticles()).toEqual([]);
  });

  it("returns null for a missing table instead of crashing the render", async () => {
    mockQuery({ data: null, error: TABLE_MISSING });
    expect(await getPublishedArticleBySlug("a-guide")).toBeNull();
  });

  it("returns the article when it exists", async () => {
    mockQuery({ data: ROW, error: null });
    expect(await getPublishedArticleBySlug("a-guide")).toEqual(ROW);
  });

  it("still distinguishes 'no such slug' from a database failure", async () => {
    mockQuery({ data: null, error: null });
    expect(await getPublishedArticleBySlug("nope")).toBeNull();
  });

  it("returns no slugs when the query errors", async () => {
    mockQuery({ data: null, error: TABLE_MISSING });
    expect(await getPublishedSlugsLive()).toEqual([]);
  });

  it("returns no categories from the public getter", async () => {
    mockQuery({ data: null, error: TABLE_MISSING });
    expect(await getPublicCategories()).toEqual([]);
  });

  it("degrades a category page to 'not found' rather than throwing", async () => {
    mockQuery({ data: null, error: TABLE_MISSING });
    expect(await getArticlesByCategory("security")).toEqual({
      category: null,
      articles: [],
    });
  });

  it("returns no related articles when the query errors", async () => {
    mockQuery({ data: null, error: TABLE_MISSING });
    expect(
      await getRelatedArticles({ id: "a1", category_id: "c1" }),
    ).toEqual([]);
  });

  it("does not query at all for an uncategorised article", async () => {
    expect(
      await getRelatedArticles({ id: "a1", category_id: null }),
    ).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("admin reads stay strict", () => {
  beforeEach(() => {
    fromMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("throws when categories cannot be loaded, so the CMS never shows a false empty", async () => {
    mockQuery({ data: null, error: { message: "boom" } });
    await expect(getCategories()).rejects.toThrow(
      "Failed to load categories: boom",
    );
  });

  it("returns categories on success", async () => {
    const categories = [{ id: "c1", slug: "security", name: "Security" }];
    mockQuery({ data: categories, error: null });
    expect(await getCategories()).toEqual(categories);
  });
});
