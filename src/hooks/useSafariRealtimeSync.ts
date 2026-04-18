import { useEffect, useRef } from 'react';
import { realtimeManager } from '../lib/realtimeManager';

const SAFARI_TABLES = ['bookings', 'vehicles', 'clients', 'safari_bookings'] as const;

/**
 * Subscribes to realtime changes for Safari-relevant tables via the
 * centralised RealtimeManager (shared channels — no duplicates with Dashboard).
 */
export function useSafariRealtimeSync(onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const unsub = realtimeManager.subscribe(
      [...SAFARI_TABLES],
      () => onUpdateRef.current(),
      'Safari',
    );
    return unsub;
  }, []);
}
