import { devLog } from './devLog';

export function logRealtimeStatus(
  scope: string,
  table: string,
  status: string,
  isCleaningUp: boolean
): void {
  if (status === 'CLOSED' && isCleaningUp) {
    return;
  }

  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    console.warn(`[${scope}] ${table} subscription status:`, status);
    return;
  }

  devLog(`[${scope}] ${table} subscription status:`, status);
}
