import { useEffect, useRef } from 'react';
import { realtimeManager } from '../lib/realtimeManager';

const DASHBOARD_TABLES = [
  'bookings',
  'vehicles',
  'repairs',
  'cash_requisitions',
  'financial_transactions',
  'safari_bookings',
  'exchange_rates',
] as const;

/**
 * Subscribes to realtime changes for all Dashboard-relevant tables via the
 * centralised RealtimeManager (one shared channel per table — no duplicates).
 */
export function useDashboardRealtimeSync(onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const unsub = realtimeManager.subscribe(
      [...DASHBOARD_TABLES],
      () => onUpdateRef.current(),
      'Dashboard',
    );
    return unsub;
  }, []);
}
