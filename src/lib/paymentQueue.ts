/**
 * Offline payment queue.
 *
 * Found in the Oct 2026 sync & robustness audit: `record_payment`'s request_id
 * protects against double-submission on a *manual* retry, but nothing queued a
 * payment that failed because the device had no signal — which matters for a
 * safari ops app whose users are routinely inside national parks with none.
 * This persists a payment attempt to AsyncStorage when the device is offline
 * at submit time, and a caller drains it once connectivity returns, reusing
 * the SAME request_id so record_payment's idempotency still applies if the
 * attempt had actually gone through right before the device dropped signal.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { devError } from './devLog';
import type { RecordPaymentParams } from './paymentMethods';

const STORAGE_KEY = 'jackal.pendingPayments.v1';

export interface QueuedPayment {
  /** Same as RecordPaymentParams.requestId — the queue entry key. */
  requestId: string;
  params: RecordPaymentParams;
  queuedAt: string;
  subjectLabel: string;
}

async function readQueue(): Promise<QueuedPayment[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedPayment[]) : [];
  } catch (e) {
    devError('[PaymentQueue] failed to read queue:', e);
    return [];
  }
}

async function writeQueue(queue: QueuedPayment[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    devError('[PaymentQueue] failed to write queue:', e);
  }
}

export async function enqueuePayment(params: RecordPaymentParams, subjectLabel: string): Promise<void> {
  const queue = await readQueue();
  queue.push({ requestId: params.requestId, params, queuedAt: new Date().toISOString(), subjectLabel });
  await writeQueue(queue);
}

export async function getQueuedPayments(): Promise<QueuedPayment[]> {
  return readQueue();
}

export async function removeFromQueue(requestId: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter(q => q.requestId !== requestId));
}

export async function getQueueLength(): Promise<number> {
  return (await readQueue()).length;
}
