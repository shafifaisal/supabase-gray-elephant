import type { Metadata } from "next";

import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Audit logs",
  robots: { index: false, follow: false },
};

interface AuditRow {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_state: unknown;
  after_state: unknown;
  created_at: string;
  profile: { email: string | null } | null;
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  await requireRole("admin");
  const { action } = await searchParams;

  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity_type, entity_id, before_state, after_state, created_at, profiles(email)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (action) query = query.eq("action", action);

  const { data, error } = await query;

  const rows = (data ?? []) as unknown as AuditRow[];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Audit logs</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Append-only record of administrative actions. Entries cannot be edited or
        deleted, by anyone.
      </p>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error.message}
        </p>
      ) : null}

      <form className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="action" className="mb-1 block text-xs font-medium">
            Filter by action
          </label>
          <input
            id="action"
            name="action"
            defaultValue={action ?? ""}
            placeholder="article.published"
            className="rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-md border border-border px-3 text-sm font-semibold hover:bg-secondary"
        >
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-border bg-secondary/40 p-8 text-center text-sm text-muted-foreground">
          No audit entries yet.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-border bg-background">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Administrative audit log, most recent first
            </caption>
            <thead className="border-b border-border bg-secondary/40">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">When</th>
                <th scope="col" className="px-4 py-3 font-semibold">Action</th>
                <th scope="col" className="px-4 py-3 font-semibold">Entity</th>
                <th scope="col" className="px-4 py-3 font-semibold">Actor</th>
                <th scope="col" className="px-4 py-3 font-semibold">Changes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {formatDateTime(new Date(row.created_at))}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.action}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="text-muted-foreground">{row.entity_type}</span>
                    {row.entity_id ? (
                      <span className="ml-1 font-mono">{row.entity_id.slice(0, 8)}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {row.profile?.email ?? (row.actor_id ? row.actor_id.slice(0, 8) : "system")}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <code className="block max-w-xs truncate">
                      {JSON.stringify(row.after_state ?? row.before_state ?? null)}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Showing the {rows.length} most recent entries.
      </p>
    </div>
  );
}