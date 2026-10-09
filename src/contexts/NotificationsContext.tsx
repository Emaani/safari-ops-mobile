/**
 * NotificationsContext
 *
 * Found in the Oct 2026 sync & robustness audit: useNotifications(userId) was
 * being instantiated independently in three places (app root, the header's
 * NotificationBell, and NotificationsScreen) that are normally all mounted at
 * once — each running its own unbounded `notifications` fetch AND opening its
 * own realtime channel under the identical name `notifications-${userId}`.
 *
 * This provider runs the hook exactly once and shares the result, so there is
 * one fetch and one channel no matter how many consumers are mounted. It does
 * NOT route through realtimeManager's generic per-table "something changed,
 * refetch everything" model, because useNotifications relies on the realtime
 * payload itself to do incremental INSERT/UPDATE/DELETE patching and to detect
 * genuinely new notifications for the toast banner (onNotificationInsert) —
 * a blunt refetch signal can't distinguish "a new notification arrived" from
 * "one was marked read," which would break toasts.
 */

import React, { createContext, useContext } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import type { Notification } from '../types/notification';

type NotificationsContextValue = ReturnType<typeof useNotifications>;

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

interface NotificationsProviderProps {
  userId: string;
  onNotificationInsert?: (notification: Notification) => void;
  children: React.ReactNode;
}

export function NotificationsProvider({ userId, onNotificationInsert, children }: NotificationsProviderProps) {
  const value = useNotifications(userId, onNotificationInsert);
  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

/** Must be called under NotificationsProvider — throws otherwise so a missing provider fails loudly, not with silent undefined access. */
export function useNotificationsContext(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotificationsContext must be used within a NotificationsProvider');
  return ctx;
}
