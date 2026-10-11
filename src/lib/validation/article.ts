import { z } from "zod";

/**
 * Article status values, mirroring the `article_status` enum.
 */
export const ARTICLE_STATUSES = [
  "draft",
  "in_review",
  "scheduled",
  "published",
  "archived",
] as const;

export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

const uuid = z.string().uuid();

/** Slug rules: lowercase, hyphen separated, no leading/trailing hyphen. */
const slug = z
  .string()
  .min(1, "Slug is required")
  .max(120, "Slug must be 120 characters or fewer")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single hyphens",
  );

/** Server Actions accept FormData, where every field arrives as a string. */
const optionalUuid = z
  .string()
  .transform((value) => (value === "" || value === null ? null : value))
  .pipe(uuid.nullable());

const optionalBoolean = z
  .string()
  .transform((value) => value === "on" || value === "true" || value === "1");

export const articleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or fewer"),
  slug,
  excerpt: z
    .string()
    .trim()
    .max(500, "Excerpt must be 500 characters or fewer")
    .optional()
    .or(z.literal("")),
  body_md: z
    .string()
    .max(100_000, "Article body must be 100,000 characters or fewer")
    .default(""),
  category_id: optionalUuid,
  seo_title: z
    .string()
    .trim()
    .max(70, "SEO title should be 70 characters or fewer for best display")
    .optional()
    .or(z.literal("")),
  meta_description: z
    .string()
    .trim()
    .max(180, "Meta description should be 180 characters or fewer")
    .optional()
    .or(z.literal("")),
  og_title: z.string().trim().max(100).optional().or(z.literal("")),
  og_description: z.string().trim().max(200).optional().or(z.literal("")),
  canonical_url: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || /^https?:\/\/[^\s]+$/i.test(value),
      "Canonical URL must be an absolute http(s) URL",
    ),
  is_noindex: optionalBoolean,
  featured_image_id: optionalUuid,
  // datetime-local inputs submit a local time with no zone offset, so an
  // offset is required when normalising to an ISO instant.
  scheduled_for: z
    .string()
    .transform((value) => (value === "" || value == null ? null : value))
    .nullable()
    .refine(
      (value) =>
        value === null ||
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?$/.test(value),
      "Enter a valid date and time",
    ),
});

export type ArticleInput = z.infer<typeof articleSchema>;

export const slugChangeSchema = z.object({
  id: uuid,
  slug,
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  slug,
  description: z.string().trim().max(500).optional().or(z.literal("")),
  position: z.coerce.number().int().min(0).max(9999).default(0),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export const tagSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  slug,
});

export const settingSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores"),
  value: z.unknown(),
  is_secret: z.boolean().default(false),
});

export const userRoleSchema = z.object({
  userId: uuid,
  role: z.enum(["admin", "editor", "author"]),
  status: z.enum(["active", "invited", "suspended"]).default("active"),
});

/**
 * Converts a Zod error into a flat `{ field: message }` map for the UI.
 */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !result[key]) {
      result[key] = issue.message;
    }
  }

  return result;
}

/** Shared action return type. */
export interface ActionState {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}