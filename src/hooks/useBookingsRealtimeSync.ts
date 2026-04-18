import { useEffect, useRef } from 'react';
import { realtimeManager } from '../lib/realtimeManager';

const BOOKINGS_TABLES = ['bookings', 'clients', 'vehicles'] as const;

/**
 * Subscribes to realtime changes for Bookings-relevant tables via the
 * centralised RealtimeManager (shared channels — no duplicates with Dashboard).
 */
export function useBookingsRealtimeSync(onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const unsub = realtimeManager.subscribe(
      [...BOOKINGS_TABLES],
      () => onUpdateRef.current(),
      'Bookings',
    );
    return unsub;
  }, []);
}
