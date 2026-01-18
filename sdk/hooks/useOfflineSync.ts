/**
 * useOfflineSync Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { JackalSDK } from '../core/JackalSDK';
import type { SyncStatus } from '../offline/OfflineSyncService';

export function useOfflineSync() {
  const sdk = JackalSDK.getInstance();
  const [status, setStatus] = useState<SyncStatus>(sdk.offlineSync.getStatus());

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(sdk.offlineSync.getStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const syncNow = useCallback(async () => {
    await sdk.offlineSync.syncNow();
    setStatus(sdk.offlineSync.getStatus());
  }, []);

  const addOperation = useCallback(async (type: 'CREATE' | 'UPDATE' | 'DELETE', resource: string, data: any) => {
    await sdk.offlineSync.addOperation(type, resource, data);
    setStatus(sdk.offlineSync.getStatus());
  }, []);

  const retryFailed = useCallback(async () => {
    await sdk.offlineSync.retryFailedOperations();
    setStatus(sdk.offlineSync.getStatus());
  }, []);

  return {
    status,
    syncNow,
    addOperation,
    retryFailed,
    isOnline: status.isOnline,
    isSyncing: status.isSyncing,
    pendingOperations: status.pendingOperations,
    failedOperations: status.failedOperations,
  };
}
