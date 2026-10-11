import type { Metadata } from "next";

import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type { Role } from "@/lib/auth/session";

import { changeUserRoleAction } from "./actions";

export const metadata: Metadata = {
  title: "Users",
  robots: { index: false, follow: false },
};

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  status: "active" | "invited" | "suspended";
  created_at: string;
  updated_at: string;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const current = await requireRole("admin");
  const { error, saved } = await searchParams;

  const supabase = await createClient();

  const { data, error: queryError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status, created_at, updated_at")
    .order("created_at", { ascending: true });

  const users = (data ?? []) as ProfileRow[];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Users</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Roles control what each person can do. Changes are enforced by database
        policies, not just hidden in the interface.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {saved ? (
        <p
          role="status"
          className="mt-4 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
        >
          User updated.
        </p>
      ) : null}

      {queryError ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {queryError.message}
        </p>
      ) : null}

      <ul className="mt-6 space-y-2">
        {users.map((user) => (
          <li
            key={user.id}
            className="rounded-[var(--radius-card)] border border-border bg-background p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold">
                  {user.full_name || user.email || user.id}
                  {user.id === current.id ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (you)
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {user.id}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Joined {formatDateTime(new Date(user.created_at))}
                </p>
              </div>

              <form
                action={changeUserRoleAction}
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="userId" value={user.id} />

                <div>
                  <label
                    htmlFor={`role-${user.id}`}
                    className="mb-1 block text-xs font-medium"
                  >
                    Role
                  </label>
                  <select
                    id={`role-${user.id}`}
                    name="role"
                    defaultValue={user.role}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="author">Author</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={`status-${user.id}`}
                    className="mb-1 block text-xs font-medium"
                  >
                    Status
                  </label>
                  <select
                    id={`status-${user.id}`}
                    name="status"
                    defaultValue={user.status}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="invited">Invited</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="h-9 rounded-md border border-border px-3 text-sm font-semibold hover:bg-secondary"
                >
                  Update
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-[var(--radius-card)] border border-border bg-secondary/40 p-5">
        <h2 className="text-sm font-semibold">What each role can do</h2>
        <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
          <div>
            <dt className="inline font-medium text-foreground">Author</dt>{" "}
            — create and edit their own drafts. Cannot publish.
          </div>
          <div>
            <dt className="inline font-medium text-foreground">Editor</dt>{" "}
            — review, publish, unpublish, schedule, archive, manage categories.
          </div>
          <div>
            <dt className="inline font-medium text-foreground">
              Administrator
            </dt>{" "}
            — everything, plus user management and site settings.
          </div>
        </dl>
      </div>
    </div>
  );
}