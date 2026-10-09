/**
 * usePaymentQueueSync
 *
 * Drains the offline payment queue automatically whenever connectivity comes
 * back. Mount this once near the app root (alongside useNetworkStatus) —
 * RecordPaymentSheet only ever writes to the queue, this is what reads it back.
 */

import { useEffect, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { getQueuedPayments, removeFromQueue } from '../lib/paymentQueue';
import { usePaymentRecording } from './usePaymentRecording';
import { devLog, devError } from '../lib/devLog';
import { logEvent } from '../lib/eventLogger';

export interface PaymentQueueDrainResult {
  succeeded: number;
  failed: { subjectLabel: string; error: string }[];
}

type RecordPaymentFn = ReturnType<typeof usePaymentRecording>['recordPayment'];

/**
 * Pure drain pass — shared by the automatic (connectivity-triggered) drain
 * below and a manual "Retry Now" action elsewhere, so there's one
 * implementation instead of two copies drifting apart.
 */
export async function drainPaymentQueue(recordPayment: RecordPaymentFn): Promise<PaymentQueueDrainResult> {
  const queue = await getQueuedPayments();
  const result: PaymentQueueDrainResult = { succeeded: 0, failed: [] };
  if (queue.length === 0) return result;

  devLog(`[PaymentQueueSync] draining ${queue.length} queued payment(s)...`);

  for (const entry of queue) {
    try {
      // Reuses the SAME request_id captured when the payment was queued —
      // if it had actually gone through right before the device dropped
      // signal, record_payment's idempotency check returns replayed:true
      // instead of creating a duplicate.
      const res = await recordPayment(entry.params);
      if (res.ok) {
        result.succeeded += 1;
        await removeFromQueue(entry.requestId);
      } else {
        // A genuine rejection (overpayment, duplicate reference, etc.) —
        // leave it in the queue so the user can see and act on it rather
        // than silently retrying something that will never succeed.
        result.failed.push({ subjectLabel: entry.subjectLabel, error: res.error || 'Unknown error' });
        logEvent('payment_queue_drain_failed', res.error || 'Unknown error', { requestId: entry.requestId, subjectLabel: entry.subjectLabel });
      }
    } catch (e: any) {
      devError('[PaymentQueueSync] unexpected error draining payment:', e);
      result.failed.push({ subjectLabel: entry.subjectLabel, error: e?.message || 'Unknown error' });
      logEvent('payment_queue_drain_exception', e?.message || 'Unknown error', { requestId: entry.requestId, subjectLabel: entry.subjectLabel });
    }
  }

  devLog(`[PaymentQueueSync] drain complete — ${result.succeeded} succeeded, ${result.failed.length} failed`);
  return result;
}

export function usePaymentQueueSync(onDrained?: (result: PaymentQueueDrainResult) => void) {
  const { isOnline } = useNetworkStatus();
  const { recordPayment } = usePaymentRecording();
  const drainingRef = useRef(false);

  useEffect(() => {
    if (!isOnline || drainingRef.current) return;

    (async () => {
      drainingRef.current = true;
      const result = await drainPaymentQueue(recordPayment);
      drainingRef.current = false;
      if (result.succeeded > 0 || result.failed.length > 0) onDrained?.(result);
    })();
  }, [isOnline, recordPayment, onDrained]);
}
