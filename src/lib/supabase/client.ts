import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client.
 *
 * Uses ONLY publishable/anon keys. It is safe to ship to the client because
 * every table has Row Level Security enabled — but only because of that.
 * Never import the service-role client into a Client Component.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase public environment variables are not configured. " +
        "See .env.example and docs/setup.md.",
    );
  }

  return createBrowserClient(url, anonKey);
}