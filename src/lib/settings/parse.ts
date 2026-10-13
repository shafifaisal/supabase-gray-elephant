/**
 * Setting value parsing.
 *
 * Deliberately free of `server-only` and of any Node/React import so the same
 * rules apply in Server Components, Route Handlers and the Edge proxy
 * (maintenance mode reads the same table). Keeping one implementation stops the
 * two call sites from drifting apart.
 */

/**
 * Interprets a stored value as a boolean.
 *
 * Settings are stored as JSONB, so a boolean toggle is usually a real boolean,
 * but a value typed into the admin text box may arrive as the string "true".
 * Anything that is not an explicit truthy token is treated as false — a
 * mis-typed value must fail closed (feature stays OFF).
 */
export function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }
  if (typeof value === "number") return value === 1;
  return false;
}
