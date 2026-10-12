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
import * as Crypto from 'expo-crypto';
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
      // Real RPC param names confirmed against the live schema cache:
      // p_transaction_id (not p_payment_event_id) and a REQUIRED p_request_id
      // with no default — mobile wasn't sending one at all, so every
      // reversal attempt was failing at routing before this fix.
      const { data, error } = await supabase.rpc('reverse_payment', {
        p_transaction_id: paymentEventId,
        p_reason: reason,
        p_request_id: Crypto.randomUUID(),
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
