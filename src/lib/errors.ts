/**
 * Shared error-handling helpers.
 *
 * Found in the Oct 2026 sync & robustness audit: every screen rolled its own
 * `e?.message || 'fallback text'`, and SafariManagementScreen had its own
 * inline "is this a Postgres schema-cache error" check duplicated from
 * scratch. Centralizing both here doesn't change behavior anywhere it's
 * already used correctly — it just gives future call sites one place to pull
 * from instead of reinventing the pattern.
 */

/** Extracts a user-displayable message from any thrown value, falling back to a default. */
export function getErrorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string' && (e as any).message.trim()) {
    return (e as any).message;
  }
  return fallback;
}

/**
 * True when a Supabase/PostgREST error means "this column/relation doesn't
 * exist in the schema cache" — used to fall back to an alternate column name
 * (e.g. guide_id vs assigned_guide_id) instead of hard-failing the whole save.
 */
export function isSchemaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  return (
    e.code === 'PGRST204' ||
    !!e.message?.includes('schema cache') ||
    !!e.message?.includes('Could not find') ||
    !!e.message?.includes('does not exist')
  );
}
