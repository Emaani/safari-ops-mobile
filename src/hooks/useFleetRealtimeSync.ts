import { useEffect, useRef } from 'react';
import { realtimeManager } from '../lib/realtimeManager';

const FLEET_TABLES = ['vehicles', 'repairs', 'drivers'] as const;

/**
 * Subscribes to realtime changes for Fleet-relevant tables via the
 * centralised RealtimeManager (shared channels — no duplicates with Dashboard).
 */
export function useFleetRealtimeSync(onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const unsub = realtimeManager.subscribe(
      [...FLEET_TABLES],
      () => onUpdateRef.current(),
      'Fleet',
    );
    return unsub;
  }, []);
}
