import { useEffect, useRef } from 'react';
import { realtimeManager } from '../lib/realtimeManager';

const FINANCE_TABLES = [
  'financial_transactions',
  'cash_requisitions',
  'exchange_rates',
  'bookings',
  'safari_bookings',
] as const;

/**
 * Subscribes to realtime changes for Finance-relevant tables via the
 * centralised RealtimeManager (shared channels — no duplicates with Dashboard).
 */
export function useFinanceRealtimeSync(onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const unsub = realtimeManager.subscribe(
      [...FINANCE_TABLES],
      () => onUpdateRef.current(),
      'Finance',
    );
    return unsub;
  }, []);
}
