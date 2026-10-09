/**
 * usePaymentReversal
 *
 * Reversal is restricted to admin / fleet_manager (checked server-side by the RPC
 * itself — the client-side useUserRole check only gates whether the button is
 * shown, it is never the source of truth). Recorded payments cannot be edited;
 * the server blocks that entirely — reversal + a fresh record_payment call is
 * the only correction path.
 */

import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { devError } from '../lib/devLog';

interface ReversePaymentResult {
  ok: boolean;
  reversal_transaction_id?: string;
  error?: string;
}

export function usePaymentReversal() {
  const [reversing, setReversing] = useState(false);

  const reversePayment = useCallback(async (paymentEventId: string, reason: string): Promise<ReversePaymentResult> => {
    setReversing(true);
    try {
      const { data, error } = await supabase.rpc('reverse_payment', {
        p_payment_event_id: paymentEventId,
        p_reason: reason,
      });

      if (error) {
        devError('[PaymentReversal] reverse_payment error:', error.message);
        return { ok: false, error: error.message };
      }

      const row = Array.isArray(data) ? data[0] : data;
      return { ok: true, reversal_transaction_id: row?.system_transaction_id };
    } catch (e: any) {
      devError('[PaymentReversal] reverse_payment exception:', e);
      return { ok: false, error: e?.message || 'Failed to reverse payment.' };
    } finally {
      setReversing(false);
    }
  }, []);

  return { reversePayment, reversing };
}
