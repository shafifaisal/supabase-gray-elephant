/**
 * Contact message queries for the admin inbox.
 *
 * Staff-only: Row Level Security restricts `select` on `contact_messages` to
 * editors (`is_editor()`), so this getter returns only what the signed-in
 * account is allowed to see. It deliberately throws on failure — inside the CMS
 * a silent error would look like "no messages", hiding a real problem from the
 * only people able to fix it. See the fail-soft public getters in `articles.ts`
 * for the contrasting policy.
 */

import { createClient } from "@/lib/supabase/server";

export type ContactStatus = "new" | "read" | "archived";

export interface ContactMessageRow {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  subject: string;
  message: string;
  status: ContactStatus;
  created_at: string;
}

export interface ContactMessagesPage {
  messages: ContactMessageRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/** How many messages show per inbox page. */
export const MESSAGES_PER_PAGE = 10;

const CONTACT_MESSAGE_COLUMNS =
  "id, name, email, mobile, subject, message, status, created_at";

/**
 * One page of the inbox, newest first.
 *
 * Pagination is done in Postgres with an exact count so the page can render the
 * full set of page links without loading every message.
 */
export async function getContactMessages(
  page = 1,
  perPage = MESSAGES_PER_PAGE,
): Promise<ContactMessagesPage> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const from = (safePage - 1) * perPage;
  const to = from + perPage - 1;

  const supabase = await createClient();

  const { data, error, count } = await supabase
    .from("contact_messages")
    .select(CONTACT_MESSAGE_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`Failed to load contact messages: ${error.message}`);
  }

  const total = count ?? 0;

  return {
    messages: (data ?? []) as ContactMessageRow[],
    total,
    page: safePage,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/**
 * How many messages are still unread, i.e. `status = 'new'`.
 *
 * `head: true` makes this a count-only request: no message name, email or body
 * crosses the wire, because the dashboard badge needs a number and nothing
 * else. The `contact_messages_status_idx` index covers the filter.
 *
 * Like every other getter here it throws on failure rather than reporting 0,
 * because "0 unread" and "the count failed" must not look identical to an
 * editor. RLS (`contact_messages_staff_read`, `is_editor()`) means an author
 * calling this simply sees 0 rows, so callers must gate on role instead of
 * reading 0 as an empty inbox.
 */
export async function countUnreadMessages(): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");

  if (error) {
    throw new Error(`Failed to count unread contact messages: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * Every contact message, newest first, for the bulk export.
 *
 * Staff-only: the same `is_editor()` RLS policy that governs the inbox applies
 * here, so a caller can only export what they are already allowed to read.
 */
export async function getAllContactMessages(): Promise<ContactMessageRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contact_messages")
    .select(CONTACT_MESSAGE_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load contact messages: ${error.message}`);
  }

  return (data ?? []) as ContactMessageRow[];
}
