import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const ROLES = ["admin", "editor", "author"] as const;
export type Role = (typeof ROLES)[number];

export interface SessionUser {
  id: string;
  email: string | null;
  role: Role;
  status: "active" | "invited" | "suspended";
}

/**
 * Returns the authenticated user and their server-resolved role, or null when
 * there is no valid session.
 *
 * The role is read from `public.profiles` — never from client input, never from
 * JWT metadata the caller controls.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status, email")
    .eq("id", user.id)
    .maybeSingle<{
      role: Role;
      status: SessionUser["status"];
      email: string | null;
    }>();

  if (!profile) return null;

  return {
    id: user.id,
    email: profile.email ?? user.email ?? null,
    role: profile.role,
    status: profile.status,
  };
}

/** Rank used for role comparisons. Higher outranks lower. */
const ROLE_RANK: Record<Role, number> = { author: 1, editor: 2, admin: 3 };

export function roleAtLeast(
  role: Role | undefined,
  required: Role,
): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

/** Redirects to /login when signed out; to /admin/forbidden when under-privileged. */
export async function requireRole(required: Role): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) redirect("/login");

  if (user.status === "suspended") redirect("/admin/forbidden");

  if (!roleAtLeast(user.role, required)) redirect("/admin/forbidden");

  return user;
}

/** Throws instead of redirecting. For use inside Server Actions and API routes. */
export async function assertRole(required: Role): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) throw new AuthError("Not authenticated", 401);
  if (user.status === "suspended") throw new AuthError("Account suspended", 403);
  if (!roleAtLeast(user.role, required)) {
    throw new AuthError(`Requires ${required} role`, 403);
  }

  return user;
}

export class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/** Converts an auth user into the shape the UI expects. */
export function toUserSummary(user: User, role: Role) {
  return { id: user.id, email: user.email ?? null, role };
}