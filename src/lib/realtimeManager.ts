/**
 * Centralised Supabase Realtime Manager
 *
 * Problem solved:
 *   Previously every screen created its own set of Supabase channels for the
 *   SAME tables (e.g. "bookings" was subscribed to by Dashboard, Bookings,
 *   Safari and the notification hooks — 4 separate channels).  Each channel
 *   fired its own debounced refetch, causing 4× redundant data loads after
 *   every single database event.
 *
 * Solution:
 *   One shared channel per table.  Components register a callback for the
 *   tables they care about.  When a row changes, only ONE channel fires, and
 *   every registered callback is called once.
 *
 * Usage:
 *   // Subscribe — returns an unsubscribe function
 *   const unsub = realtimeManager.subscribe(
 *     ['bookings', 'clients'],  // tables
 *     () => refetchMyData(),    // callback
 *     'MyScreen',               // debug label
 *   );
 *
 *   // In useEffect cleanup:
 *   return () => unsub();
 */

import { supabase } from './supabase';
import { devLog } from './devLog';
import type { RealtimeChannel } from '@supabase/supabase-js';

// All tables the app cares about
const ALL_TABLES = [
  'bookings',
  'vehicles',
  'repairs',
  'cash_requisitions',
  'financial_transactions',
  'safari_bookings',
  'exchange_rates',
  'clients',
  'profiles',
  'drivers',
  'notifications',
] as const;

type AppTable = typeof ALL_TABLES[number];

// Each subscriber has a set of tables it cares about and a debounced callback
interface Subscriber {
  id:      number;
  tables:  Set<AppTable>;
  label:   string;
  timer:   ReturnType<typeof setTimeout> | null;
  handler: () => void;
}

const DEBOUNCE_MS = 400;

class RealtimeManager {
  private channels: Map<AppTable, RealtimeChannel> = new Map();
  private subscribers: Map<number, Subscriber>     = new Map();
  private nextId  = 1;
  private started = false;

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Subscribe to changes on one or more tables.
   * Returns a cleanup function — call it in useEffect return.
   */
  subscribe(
    tables:  AppTable[],
    handler: () => void,
    label:   string = 'unknown',
  ): () => void {
    const id: number = this.nextId++;
    const sub: Subscriber = {
      id,
      tables: new Set(tables),
      label,
      timer:  null,
      handler,
    };
    this.subscribers.set(id, sub);
    devLog(`[Realtime] +subscriber #${id} (${label}) → [${tables.join(', ')}]`);

    // Ensure channels exist for requested tables
    this.ensureChannels(tables);

    return () => {
      const s = this.subscribers.get(id);
      if (s?.timer) clearTimeout(s.timer);
      this.subscribers.delete(id);
      devLog(`[Realtime] -subscriber #${id} (${label})`);
    };
  }

  /**
   * Force all subscribers to refresh immediately (e.g. on foreground).
   */
  refreshAll(): void {
    devLog('[Realtime] refreshAll triggered');
    this.subscribers.forEach((sub) => {
      if (sub.timer) clearTimeout(sub.timer);
      sub.timer = null;
      sub.handler();
    });
  }

  /**
   * Refresh only the subscribers interested in specific tables
   * (used after a reconnect on a per-table basis).
   */
  refreshForTables(tables: AppTable[]): void {
    const affected = new Set(tables);
    this.subscribers.forEach((sub) => {
      const overlaps = tables.some((t) => sub.tables.has(t));
      if (!overlaps) return;
      if (sub.timer) clearTimeout(sub.timer);
      sub.timer = setTimeout(() => {
        sub.timer = null;
        devLog(`[Realtime] debounced refresh → ${sub.label}`);
        sub.handler();
      }, DEBOUNCE_MS);
    });
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private ensureChannels(tables: AppTable[]): void {
    tables.forEach((table) => {
      if (this.channels.has(table)) return; // already subscribed

      devLog(`[Realtime] Creating channel for table: ${table}`);
      const channelName = `app-${table}-changes`;

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => {
            devLog(`[Realtime] ${table} ${payload.eventType}`);
            this.notifySubscribers(table);
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            devLog(`[Realtime] ✓ subscribed to ${table}`);
          } else if (status === 'CHANNEL_ERROR') {
            console.warn(`[Realtime] Channel error on ${table}:`, err);
          } else if (status === 'CLOSED') {
            // Channel was removed — clean up our map so it can be recreated
            devLog(`[Realtime] Channel closed for ${table}`);
            this.channels.delete(table);
          }
        });

      this.channels.set(table, channel);
    });
  }

  private notifySubscribers(table: AppTable): void {
    this.subscribers.forEach((sub) => {
      if (!sub.tables.has(table)) return;

      // Debounce per subscriber — prevents rapid multi-table events from
      // triggering multiple refetches for the same subscriber
      if (sub.timer) clearTimeout(sub.timer);
      sub.timer = setTimeout(() => {
        sub.timer = null;
        devLog(`[Realtime] → ${sub.label}`);
        sub.handler();
      }, DEBOUNCE_MS);
    });
  }
}

// Singleton — one instance for the entire app lifetime
export const realtimeManager = new RealtimeManager();
