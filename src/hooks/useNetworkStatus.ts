/**
 * useNetworkStatus
 *
 * Monitors device connectivity via @react-native-community/netinfo.
 * Uses the native platform APIs rather than polling an external URL.
 */
import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  connectionType: string | null;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline:            true,   // Optimistic default — avoids flash on boot
    isInternetReachable: null,
    connectionType:      null,
  });

  useEffect(() => {
    // Fetch once immediately
    NetInfo.fetch().then((state: NetInfoState) => {
      setStatus({
        isOnline:            state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable,
        connectionType:      state.type,
      });
    });

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setStatus({
        isOnline:            state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable,
        connectionType:      state.type,
      });
    });

    return unsubscribe;
  }, []);

  return status;
}

export default useNetworkStatus;
