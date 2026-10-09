-- ============================================================================
-- SAFARI OPS MOBILE - CLIENT EVENT LOG
-- ============================================================================
-- No Sentry/Bugsnag/Crashlytics credentials exist for this app yet, so this
-- is a pragmatic self-hosted substitute: a single table the mobile client
-- writes to (fire-and-forget, never blocking the UI) whenever something
-- worth knowing about fails — a queued offline action that couldn't drain,
-- a realtime channel dropping, an exchange-rate fetch failing, a CR approval
-- RPC erroring. It is NOT a replacement for a real crash reporter (no stack
-- traces, no device/OS breadcrumbs) — just enough to answer "is this
-- happening to real users, how often, and to whom" from the Supabase table
-- editor or a SQL query, without needing a third-party account.
--
-- Run this script in your Supabase SQL Editor or via psql.
-- Safe to re-run (CREATE TABLE/POLICY use IF NOT EXISTS / guards).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.client_event_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    severity    TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error')),
    event_type  TEXT NOT NULL,          -- e.g. 'cr_status_update_failed', 'payment_queue_drain_failed', 'realtime_channel_error', 'exchange_rate_fetch_failed'
    message     TEXT NOT NULL,
    context     JSONB DEFAULT '{}'::jsonb,  -- free-form extra detail (crId, table name, error code, etc.) — never put secrets/tokens in here
    platform    TEXT,                   -- 'ios' | 'android'
    app_version TEXT
);

CREATE INDEX IF NOT EXISTS idx_client_event_log_created_at ON public.client_event_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_event_log_event_type ON public.client_event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_client_event_log_user_id    ON public.client_event_log(user_id);

ALTER TABLE public.client_event_log ENABLE ROW LEVEL SECURITY;

-- Any signed-in user can log an event, but only as themselves.
CREATE POLICY "Users can insert own events"
    ON public.client_event_log
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Only admin/fleet_manager can read the log — it's an operational
-- diagnostics table, not user-facing data. Mirrors the elevated-role check
-- mobile already does client-side via useUserRole (ELEVATED_ROLES).
CREATE POLICY "Admins can view event log"
    ON public.client_event_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
              AND user_roles.role IN ('admin', 'fleet_manager')
        )
    );

-- Keep this table from growing unbounded — 60 days of history is plenty for
-- an operational log nobody is paging off of.
CREATE OR REPLACE FUNCTION cleanup_old_client_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.client_event_log
    WHERE created_at < NOW() - INTERVAL '60 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- To schedule, use pg_cron (if enabled on the project):
-- SELECT cron.schedule('cleanup-client-event-log', '0 3 * * *', 'SELECT cleanup_old_client_events()');

COMMENT ON TABLE public.client_event_log IS 'Lightweight self-hosted diagnostics log written by the mobile app (no Sentry/Bugsnag account configured). Fire-and-forget; never blocks the UI on failure.';
