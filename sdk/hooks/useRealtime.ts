/**
 * useRealtime Hook
 */

import { useEffect } from 'react';
import { JackalSDK } from '../core/JackalSDK';
import type { RealtimeEvent } from '../realtime/RealtimeService';

export function useRealtime<T = any>(
  table: string,
  callback: (event: RealtimeEvent<T>) => void,
  options?: {
    schema?: string;
    filter?: string;
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  }
) {
  const sdk = JackalSDK.getInstance();

  useEffect(() => {
    let unsubscribe: (() => Promise<void>) | null = null;

    const subscribe = async () => {
      unsubscribe = await sdk.realtime.subscribeToTable<T>(table, callback, options);
    };

    subscribe().catch((error) => {
      sdk.logger.error('[useRealtime] Subscription failed', error);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe().catch((error) => {
          sdk.logger.error('[useRealtime] Unsubscribe failed', error);
        });
      }
    };
  }, [table, options?.schema, options?.filter, options?.event]);
}
