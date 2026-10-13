"use client";

import { useActionState, useState } from "react";

import { ActionButton } from "@/components/admin/action-button";
import { slugifyTitle } from "@/lib/format";
import type { ActionState } from "@/lib/validation/article";

import { deleteTagAction } from "@/app/admin/tags/actions";

const inputClasses =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none";

const labelClasses = "mb-1.5 block text-sm font-medium";

export function TagManager({
  action,
  tags,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  tags: { id: string; name: string; slug: string }[];
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
      <section className="rounded-[var(--radius-card)] border border-border bg-background p-9">
        <h2 className="text-sm font-semibold">Add a tag</h2>

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
            {state.fieldErrors?.slug ? (
              <p className="mt-1 text-sm text-danger">{state.fieldErrors.slug}</p>
            ) : null}
          </div>

          {state.success ? (
            <p role="status" className="text-sm text-success">
              Tag created.
            </p>
          ) : null}

          {state.error ? (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          ) : null}

          <ActionButton>Add tag</ActionButton>
        </form>
      </section>

      <section className="rounded-[var(--radius-card)] border border-border bg-background p-9">
        <h2 className="text-sm font-semibold">Existing ({tags.length})</h2>

        {tags.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No tags yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {tags.map((tag) => (
              <TagRow key={tag.id} tag={tag} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TagRow({
  tag,
}: {
  tag: { id: string; name: string; slug: string };
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-2 last:border-0">
      <div className="min-w-0">
        <p className="font-medium">{tag.name}</p>
        <p className="font-mono text-xs text-muted-foreground">{tag.slug}</p>
      </div>

      <form action={deleteTagAction}>
        <input type="hidden" name="id" value={tag.id} />
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
