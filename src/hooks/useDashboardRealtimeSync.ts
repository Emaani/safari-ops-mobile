import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

const DEBOUNCE_MS = 500;

/**
 * Hook to subscribe to realtime updates for Dashboard tables
 * Matches web Dashboard implementation exactly
 */
export function useDashboardRealtimeSync(onUpdate: () => void) {
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced update handler
  const debouncedUpdate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      console.log('[Dashboard Realtime] Triggering data refetch...');
      onUpdate();
    }, DEBOUNCE_MS);
  }, [onUpdate]);

  useEffect(() => {
    console.log('[Dashboard Realtime] Initializing subscriptions...');

    const tables = [
      'bookings',
      'vehicles',
      'repairs',
      'cash_requisitions',
      'financial_transactions',
      'safari_bookings',
      'exchange_rates',
    ];

    // Create channels for each table
    const channels = tables.map(table => {
      const channel = supabase
        .channel(`dashboard-${table}-changes`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: table,
          },
          (payload) => {
            console.log(`[Dashboard Realtime] ${table} changed:`, payload.eventType);
            debouncedUpdate();
          }
        )
        .subscribe((status) => {
          console.log(`[Dashboard Realtime] ${table} subscription status:`, status);
        });

      return channel;
    });

    channelsRef.current = channels;

    // Cleanup on unmount
    return () => {
      console.log('[Dashboard Realtime] Cleaning up subscriptions...');

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });

      channelsRef.current = [];
    };
  }, [debouncedUpdate]);
}
