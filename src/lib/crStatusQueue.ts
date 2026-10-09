/**
 * Offline queue for cash requisition status changes (Approve/Decline/Cancel).
 *
 * Mirrors paymentQueue.ts. update_cr_status has no request_id/idempotency key
 * of its own — the server's "a finished CR cannot change status again" rule
 * is what makes a replay safe: if the original attempt actually went through
 * right before the device dropped signal, the replay just fails with that
 * exact message, which useCashRequisitionStatus already reports back as
 * `alreadyFinished` — the drain loop treats that as a success, not an error.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { devError } from './devLog';
import type { CrStatusAction } from '../hooks/useCashRequisitionStatus';

const STORAGE_KEY = 'jackal.pendingCrActions.v1';

export interface QueuedCrAction {
  crId: string;
  crNumber: string;
  action: CrStatusAction;
  notes: string | null;
  reason: string | null;
  queuedAt: string;
}

async function readQueue(): Promise<QueuedCrAction[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedCrAction[]) : [];
  } catch (e) {
    devError('[CrStatusQueue] failed to read queue:', e);
    return [];
  }
}

async function writeQueue(queue: QueuedCrAction[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    devError('[CrStatusQueue] failed to write queue:', e);
  }
}

export async function enqueueCrAction(entry: Omit<QueuedCrAction, 'queuedAt'>): Promise<void> {
  const queue = await readQueue();
  queue.push({ ...entry, queuedAt: new Date().toISOString() });
  await writeQueue(queue);
}

export async function getQueuedCrActions(): Promise<QueuedCrAction[]> {
  return readQueue();
}

export async function removeCrActionFromQueue(crId: string, action: CrStatusAction): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter(q => !(q.crId === crId && q.action === action)));
}

export async function getCrQueueLength(): Promise<number> {
  return (await readQueue()).length;
}
