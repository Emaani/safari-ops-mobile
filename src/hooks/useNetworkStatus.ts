import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to detect network connectivity status
 * Returns online/offline status and provides a way to manually check
 */

interface NetworkStatus {
  isOnline: boolean;
  isChecking: boolean;
}

export function useNetworkStatus(): NetworkStatus & { checkConnection: () => Promise<boolean> } {
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  // Check connection by making a simple fetch request
  const checkConnection = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      // Try to fetch a small resource to verify connectivity
      // Using a simple HEAD request to minimize data transfer
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      setIsOnline(true);
      setIsChecking(false);
      return true;
    } catch (error) {
      setIsOnline(false);
      setIsChecking(false);
      return false;
    }
  }, []);

  // Check connection on mount and periodically
  useEffect(() => {
    // Initial check
    checkConnection();

    // Check every 30 seconds when online, every 10 seconds when offline
    const intervalId = setInterval(
      () => {
        checkConnection();
      },
      isOnline ? 30000 : 10000
    );

    return () => clearInterval(intervalId);
  }, [checkConnection, isOnline]);

  return {
    isOnline,
    isChecking,
    checkConnection,
  };
}

export default useNetworkStatus;
