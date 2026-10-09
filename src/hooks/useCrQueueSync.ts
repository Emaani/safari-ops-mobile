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

export interface CrQueueDrainResult {
  succeeded: number;
  failed: { crNumber: string; action: string; error: string }[];
}

export function useCrQueueSync(onDrained?: (result: CrQueueDrainResult) => void) {
  const { isOnline } = useNetworkStatus();
  const { updateStatus } = useCashRequisitionStatus();
  const drainingRef = useRef(false);

  useEffect(() => {
    if (!isOnline || drainingRef.current) return;

    (async () => {
      const queue = await getQueuedCrActions();
      if (queue.length === 0) return;

      drainingRef.current = true;
      devLog(`[CrQueueSync] draining ${queue.length} queued CR action(s)...`);

      const result: CrQueueDrainResult = { succeeded: 0, failed: [] };

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
          }
        } catch (e: any) {
          devError('[CrQueueSync] unexpected error draining CR action:', e);
          result.failed.push({ crNumber: entry.crNumber, action: entry.action, error: e?.message || 'Unknown error' });
        }
      }

      drainingRef.current = false;
      devLog(`[CrQueueSync] drain complete — ${result.succeeded} succeeded, ${result.failed.length} failed`);
      onDrained?.(result);
    })();
  }, [isOnline, updateStatus, onDrained]);
}
