"use client";

import { useActionState, useState } from "react";

import { ActionButton } from "@/components/admin/action-button";
import { slugifyTitle } from "@/lib/format";
import type { ActionState } from "@/lib/validation/article";

import { deleteCategoryAction } from "@/app/admin/categories/actions";

const inputClasses =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none";

const labelClasses = "mb-1.5 block text-sm font-medium";

export function CategoryManager({
  action,
  categories,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  categories: { id: string; name: string; slug: string; description: string | null; position: number }[];
}) {
  const [state, formAction] = useActionState(action, {});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(slugifyTitle(value));
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="rounded-[var(--radius-card)] border border-border bg-background p-5">
        <h2 className="text-sm font-semibold">Add a category</h2>

        <form action={formAction} className="mt-4 space-y-4">
          <div>
            <label htmlFor="name" className={labelClasses}>
              Name
            </label>
            <input
              id="name"
              name="name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              required
              className={inputClasses}
            />
            {state.fieldErrors?.name ? (
              <p className="mt-1 text-sm text-danger">{state.fieldErrors.name}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="slug" className={labelClasses}>
              Slug
            </label>
            <input
              id="slug"
              name="slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
              required
              className={`${inputClasses} font-mono`}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Public URL: /articles/category/{slug || "…"}
            </p>
            {state.fieldErrors?.slug ? (
              <p className="mt-1 text-sm text-danger">{state.fieldErrors.slug}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="description" className={labelClasses}>
              Description
            </label>
            <textarea id="description" name="description" rows={2} className={inputClasses} />
          </div>

          <div>
            <label htmlFor="position" className={labelClasses}>
              Position
            </label>
            <input
              id="position"
              name="position"
              type="number"
              min={0}
              max={9999}
              defaultValue={0}
              className={inputClasses}
            />
          </div>

          {state.success ? (
            <p role="status" className="text-sm text-success">
              Category created.
            </p>
          ) : null}

          {state.error ? (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          ) : null}

          <ActionButton>Add category</ActionButton>
        </form>
      </section>

      <section className="rounded-[var(--radius-card)] border border-border bg-background p-5">
        <h2 className="text-sm font-semibold">
          Existing ({categories.length})
        </h2>

        {categories.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No categories yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {categories.map((category) => (
              <CategoryRow key={category.id} category={category} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CategoryRow({
  category,
}: {
  category: { id: string; name: string; slug: string; description: string | null; position: number };
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-2 last:border-0">
      <div className="min-w-0">
        <p className="font-medium">{category.name}</p>
        <p className="font-mono text-xs text-muted-foreground">
          /articles/category/{category.slug}
        </p>
        {category.description ? (
          <p className="mt-1 text-xs text-muted-foreground">{category.description}</p>
        ) : null}
      </div>

      <form action={deleteCategoryAction}>
        <input type="hidden" name="id" value={category.id} />
        {confirming ? (
          <div className="flex gap-2">
            <button
              type="submit"
              className="h-8 rounded-md border border-danger/50 px-2 text-xs font-semibold text-danger"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-8 rounded-md border border-border px-2 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="h-8 rounded-md border border-border px-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
          >
            Delete
          </button>
        )}
      </form>
    </li>
  );
}