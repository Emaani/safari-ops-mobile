/**
 * useCrQueueSync
 *
 * Drains the offline cash-requisition-action queue whenever connectivity
 * returns — mirrors usePaymentQueueSync. Mount once near the app root.
 */

import { useEffect, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { getQueuedCrActions, removeCrActionFromQueue } from '../lib/crStatusQueue';
import { useCashRequisitionStatus } from './useCashRequisitionStatus';
import { devLog, devError } from '../lib/devLog';
import { logEvent } from '../lib/eventLogger';

export interface CrQueueDrainResult {
  succeeded: number;
  failed: { crNumber: string; action: string; error: string }[];
}

type UpdateStatusFn = ReturnType<typeof useCashRequisitionStatus>['updateStatus'];

/**
 * Pure drain pass — reads the queue, replays each entry, removes the ones
 * that succeeded. Extracted so both the automatic (connectivity-triggered)
 * drain below and a manual "Retry Now" action elsewhere can share one
 * implementation instead of two copies of this logic drifting apart.
 */
export async function drainCrQueue(updateStatus: UpdateStatusFn): Promise<CrQueueDrainResult> {
  const queue = await getQueuedCrActions();
  const result: CrQueueDrainResult = { succeeded: 0, failed: [] };
  if (queue.length === 0) return result;

  devLog(`[CrQueueSync] draining ${queue.length} queued CR action(s)...`);

  for (const entry of queue) {
    try {
      const res = await updateStatus(entry.crId, entry.action, { notes: entry.notes, reason: entry.reason });
      if (res.ok || res.alreadyFinished) {
        // alreadyFinished means the original attempt had actually gone
        // through before the device dropped signal — treat as success.
        result.succeeded += 1;
        await removeCrActionFromQueue(entry.crId, entry.action);
      } else {
        result.failed.push({ crNumber: entry.crNumber, action: entry.action, error: res.error || 'Unknown error' });
        logEvent('cr_queue_drain_failed', res.error || 'Unknown error', { crId: entry.crId, crNumber: entry.crNumber, action: entry.action });
      }
    } catch (e: any) {
      devError('[CrQueueSync] unexpected error draining CR action:', e);
      result.failed.push({ crNumber: entry.crNumber, action: entry.action, error: e?.message || 'Unknown error' });
      logEvent('cr_queue_drain_exception', e?.message || 'Unknown error', { crId: entry.crId, crNumber: entry.crNumber, action: entry.action });
    }
  }

  devLog(`[CrQueueSync] drain complete — ${result.succeeded} succeeded, ${result.failed.length} failed`);
  return result;
}

export function useCrQueueSync(onDrained?: (result: CrQueueDrainResult) => void) {
  const { isOnline } = useNetworkStatus();
  const { updateStatus } = useCashRequisitionStatus();
  const drainingRef = useRef(false);

  useEffect(() => {
    if (!isOnline || drainingRef.current) return;

    (async () => {
      drainingRef.current = true;
      const result = await drainCrQueue(updateStatus);
      drainingRef.current = false;
      if (result.succeeded > 0 || result.failed.length > 0) onDrained?.(result);
    })();
  }, [isOnline, updateStatus, onDrained]);
}
