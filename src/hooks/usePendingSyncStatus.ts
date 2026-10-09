/**
 * usePendingSyncStatus
 *
 * App.tsx's offline banner only shows pending-queue counts while the device
 * is OFFLINE, and resets them to 0 the instant connectivity returns — even
 * though a failed queued item (overpayment, duplicate reference, a CR the
 * server now rejects) is deliberately left in the queue by the drain logic
 * in usePaymentQueueSync / useCrQueueSync, with no further automatic retry.
 * That item is then invisible everywhere until the device goes offline and
 * back online again.
 *
 * This hook polls both queues regardless of online state, so any screen
 * (Finance, in this case) can show "N pending sync" and offer a manual
 * "Retry Now" that works even while already online.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { getQueuedPayments } from '../lib/paymentQueue';
import { getQueuedCrActions, type QueuedCrAction } from '../lib/crStatusQueue';
import { drainPaymentQueue } from './usePaymentQueueSync';
import { drainCrQueue } from './useCrQueueSync';
import { usePaymentRecording } from './usePaymentRecording';
import { useCashRequisitionStatus } from './useCashRequisitionStatus';

const POLL_MS = 4000;

export function usePendingSyncStatus() {
  const { isOnline } = useNetworkStatus();
  const { recordPayment } = usePaymentRecording();
  const { updateStatus } = useCashRequisitionStatus();
  const [pendingPaymentCount, setPendingPaymentCount] = useState(0);
  const [pendingCrActions, setPendingCrActions] = useState<QueuedCrAction[]>([]);
  const [retrying, setRetrying] = useState(false);
  const drainingRef = useRef(false);

  const refresh = useCallback(() => {
    getQueuedPayments().then((q) => setPendingPaymentCount(q.length));
    getQueuedCrActions().then(setPendingCrActions);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const retryNow = useCallback(async () => {
    if (!isOnline || drainingRef.current) return;
    drainingRef.current = true;
    setRetrying(true);
    try {
      await Promise.all([drainPaymentQueue(recordPayment), drainCrQueue(updateStatus)]);
    } finally {
      drainingRef.current = false;
      setRetrying(false);
      refresh();
    }
  }, [isOnline, recordPayment, updateStatus, refresh]);

  const pendingCrIds = new Set(pendingCrActions.map((a) => a.crId));

  return {
    pendingPaymentCount,
    pendingCrActions,
    pendingCrIds,
    pendingTotal: pendingPaymentCount + pendingCrActions.length,
    isOnline,
    retrying,
    retryNow,
  };
}
