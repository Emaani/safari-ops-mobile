import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

const DEBOUNCE_MS = 500;

/**
 * Hook to subscribe to realtime updates for Bookings tables
 * Matches Dashboard realtime sync pattern exactly
 */
export function useBookingsRealtimeSync(onUpdate: () => void) {
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced update handler
  const debouncedUpdate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      console.log('[Bookings Realtime] Triggering data refetch...');
      onUpdate();
    }, DEBOUNCE_MS);
  }, [onUpdate]);

  useEffect(() => {
    console.log('[Bookings Realtime] Initializing subscriptions...');

    const tables = ['bookings', 'clients', 'vehicles'];

    // Create channels for each table
    const channels = tables.map(table => {
      const channel = supabase
        .channel(`bookings-${table}-changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
          },
          (payload) => {
            console.log(`[Bookings Realtime] ${table} changed:`, payload.eventType);
            debouncedUpdate();
          }
        )
        .subscribe((status) => {
          console.log(`[Bookings Realtime] ${table} subscription status:`, status);
        });

      return channel;
    });

    channelsRef.current = channels;

    // Cleanup on unmount
    return () => {
      console.log('[Bookings Realtime] Cleaning up subscriptions...');

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
