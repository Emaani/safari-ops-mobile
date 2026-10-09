/**
 * usePaymentHistory
 *
 * Reads payment traceability via the `search_payment_events` RPC — payment_events
 * is read-only history (transaction ID, method, reference, status, recorded by,
 * linked receipt). NEVER use it to compute revenue/expense totals — those come
 * from bookings/safari_bookings/financial_transactions per the existing reporting rules.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { devError } from '../lib/devLog';
import type { Currency } from '../types/dashboard';
import type { PaymentMethod, PaymentSource } from '../lib/paymentMethods';

export interface PaymentEvent {
  id: string;
  system_transaction_id: string;
  source: PaymentSource;
  source_id: string;
  amount: number;
  currency: Currency;
  method: PaymentMethod;
  reference: string | null;
  payment_details: Record<string, any> | null;
  status: 'completed' | 'reversed' | string;
  transaction_date: string;
  description: string | null;
  recorded_by: string | null;
  recorded_by_name?: string | null;
  reversed_at?: string | null;
  reversed_by_name?: string | null;
  reversal_of_id?: string | null;
  receipt_document_id?: string | null;
  created_at: string;
}

interface UsePaymentHistoryOptions {
  sourceId: string | null;
  method?: PaymentMethod | 'all';
  dateFrom?: string;
  dateTo?: string;
}

export function usePaymentHistory({ sourceId, method, dateFrom, dateTo }: UsePaymentHistoryOptions) {
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!sourceId) { setEvents([]); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('search_payment_events', {
        p_search: sourceId,
        p_method: method && method !== 'all' ? method : null,
        p_from: dateFrom || null,
        p_to: dateTo || null,
      });

      if (rpcError) throw rpcError;
      // The real RPC returns a paginated wrapper {rows, total}, not a bare
      // array — confirmed directly against the live schema (the function
      // also takes p_amount/p_offset, both optional, which this screen
      // doesn't need yet).
      setEvents(((data?.rows ?? []) as PaymentEvent[]));
    } catch (e: any) {
      devError('[PaymentHistory] search_payment_events error:', e);
      setError(e?.message || 'Failed to load payment history.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [sourceId, method, dateFrom, dateTo]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return { events, loading, error, refresh: fetchHistory };
}
