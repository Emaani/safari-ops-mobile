/**
 * usePushNotifications Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { JackalSDK } from '../core/JackalSDK';
import type { NotificationPayload } from '../notifications/PushNotificationService';

export function usePushNotifications() {
  const sdk = JackalSDK.getInstance();
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [badgeCount, setBadgeCountState] = useState(0);

  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        await sdk.pushNotifications.initialize();
        const token = sdk.pushNotifications.getCurrentToken();
        setCurrentToken(token);
        setIsInitialized(true);

        const count = await sdk.pushNotifications.getBadgeCount();
        setBadgeCountState(count);
      } catch (error) {
        sdk.logger.error('[usePushNotifications] Initialization failed', error);
      }
    };

    initializeNotifications();
  }, []);

  const scheduleNotification = useCallback(async (payload: NotificationPayload) => {
    return await sdk.pushNotifications.scheduleNotification(payload);
  }, []);

  const setBadgeCount = useCallback(async (count: number) => {
    await sdk.pushNotifications.setBadgeCount(count);
    setBadgeCountState(count);
  }, []);

  const clearBadge = useCallback(async () => {
    await sdk.pushNotifications.clearBadge();
    setBadgeCountState(0);
  }, []);

  return {
    isInitialized,
    currentToken,
    badgeCount,
    scheduleNotification,
    setBadgeCount,
    clearBadge,
  };
}
