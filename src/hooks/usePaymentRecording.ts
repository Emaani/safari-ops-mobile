/**
 * usePaymentRecording
 *
 * Mobile app NEVER writes amount_paid / financial_transactions / invoices directly.
 * Every payment goes through the shared `record_payment` Postgres function so the
 * web dashboard and mobile app stay in sync on balances and system transaction IDs.
 */

import { useCallback, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';
import { devLog, devError } from '../lib/devLog';
import type { RecordPaymentParams, RecordPaymentResult } from '../lib/paymentMethods';

/** Generate once per payment attempt; reuse the SAME id on retries/offline resubmits. */
export function generateRequestId(): string {
  return Crypto.randomUUID();
}

export function usePaymentRecording() {
  const [submitting, setSubmitting] = useState(false);

  const recordPayment = useCallback(async (params: RecordPaymentParams): Promise<RecordPaymentResult> => {
    setSubmitting(true);
    try {
      devLog('[PaymentRecording] record_payment', { source: params.source, sourceId: params.sourceId, requestId: params.requestId });

      const { data, error } = await supabase.rpc('record_payment', {
        p_source: params.source,
        p_source_id: params.sourceId,
        p_amount: params.amount,
        p_method: params.method,
        p_reference: params.reference,
        p_payment_details: params.paymentDetails,
        p_transaction_date: params.transactionDate,
        p_description: params.description,
        p_request_id: params.requestId,
      });

      if (error) {
        // Surface the server's own validation message (overpayment, duplicate
        // Mobile Money reference, cancelled invoice, invalid method, etc.)
        devError('[PaymentRecording] record_payment error:', error.message);
        return { ok: false, error: error.message };
      }

      const row = Array.isArray(data) ? data[0] : data;
      return {
        ok: true,
        replayed: !!row?.replayed,
        system_transaction_id: row?.system_transaction_id,
        amount_paid: row?.amount_paid,
        balance_due: row?.balance_due,
        currency: row?.currency,
      };
    } catch (e: any) {
      devError('[PaymentRecording] record_payment exception:', e);
      return { ok: false, error: e?.message || 'Failed to record payment.' };
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { recordPayment, submitting };
}
