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

/**
 * Extracts a user-displayable message from any thrown value, falling back
 * to a default. Maps the common Postgres/PostgREST error classes to plain
 * words first — a raw "PGRST202 ... schema cache" or "42501 row-level
 * security policy" message is meaningless (and alarming) to someone just
 * trying to submit a form; a genuine application error (the server's own
 * raised exception, e.g. "Decline requires a reason") is left as-is since
 * that IS the plain-words message already.
 */
export function getErrorMessage(e: unknown, fallback: string): string {
  const err = e as { code?: string; message?: string } | null | undefined;
  const message = err && typeof err === 'object' && typeof err.message === 'string' ? err.message : '';

  if (!message.trim()) return fallback;

  if (isSchemaError(err)) {
    return 'Something went wrong on our end. Please try again, or contact support if this keeps happening.';
  }
  if (err?.code === '42501' || message.includes('row-level security policy') || message.toLowerCase().includes('permission denied')) {
    return "You don't have permission to do that.";
  }
  if (err?.code === '23505' || message.toLowerCase().includes('duplicate key')) {
    return 'This already exists — duplicate entry.';
  }
  if (err?.code === '23503' || message.toLowerCase().includes('violates foreign key constraint')) {
    return 'Related record not found — it may have been deleted or changed.';
  }
  if (err?.code === '23514' || message.toLowerCase().includes('violates check constraint')) {
    return "That value isn't allowed — please check the details and try again.";
  }
  if (message.toLowerCase().includes('network request failed') || message.toLowerCase().includes('fetch failed')) {
    return 'Check your connection and try again.';
  }

  return message;
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
