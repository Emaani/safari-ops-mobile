/**
 * eventLogger
 *
 * There is no Sentry/Bugsnag/Crashlytics account configured for this app
 * (no package, no DSN) — `logger.error` only ever reached the device's own
 * console, so a failure in the field (a queued CR action that won't drain,
 * a realtime channel dropping, an exchange-rate fetch failing) left no
 * trace anyone could see afterwards. This writes those same events to the
 * `client_event_log` Supabase table (see
 * database/migrations/client_event_log_setup.sql) so admin/fleet_manager
 * users can query what's actually failing for real users.
 *
 * Deliberately fire-and-forget: a logging failure must never surface to the
 * user or block the action that triggered it. Always logs to devError too,
 * so local dev behavior is unchanged.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { devError } from './devLog';

export type EventSeverity = 'info' | 'warning' | 'error';

const APP_VERSION = Constants.expoConfig?.version ?? 'unknown';

export function logEvent(
  eventType: string,
  message: string,
  context: Record<string, unknown> = {},
  severity: EventSeverity = 'error',
): void {
  devError(`[EventLog:${eventType}]`, message, context);

  supabase.auth.getUser().then(({ data }) => {
    const userId = data?.user?.id ?? null;
    return supabase.from('client_event_log').insert({
      user_id: userId,
      severity,
      event_type: eventType,
      message,
      context,
      platform: Platform.OS,
      app_version: APP_VERSION,
    });
  }).then(({ error }: { error: { message: string } | null }) => {
    if (error) devError('[EventLog] insert rejected:', error.message);
  }).catch((e) => {
    // Never let logging itself throw into the caller's flow.
    devError('[EventLog] failed to write event log entry:', e);
  });
}
