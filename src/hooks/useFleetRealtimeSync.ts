import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

const DEBOUNCE_MS = 500;

/**
 * Hook to subscribe to realtime updates for Fleet tables
 * Matches Dashboard realtime sync pattern exactly
 */
export function useFleetRealtimeSync(onUpdate: () => void) {
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced update handler
  const debouncedUpdate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      console.log('[Fleet Realtime] Triggering data refetch...');
      onUpdate();
    }, DEBOUNCE_MS);
  }, [onUpdate]);

  useEffect(() => {
    console.log('[Fleet Realtime] Initializing subscriptions...');

    const tables = ['vehicles', 'repairs', 'drivers'];

    // Create channels for each table
    const channels = tables.map(table => {
      const channel = supabase
        .channel(`fleet-${table}-changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
          },
          (payload) => {
            console.log(`[Fleet Realtime] ${table} changed:`, payload.eventType);
            debouncedUpdate();
          }
        )
        .subscribe((status) => {
          console.log(`[Fleet Realtime] ${table} subscription status:`, status);
        });

      return channel;
    });

    channelsRef.current = channels;

    // Cleanup on unmount
    return () => {
      console.log('[Fleet Realtime] Cleaning up subscriptions...');

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
