import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { devLog } from '../lib/devLog';
import type {
  Notification,
  NotificationFilters,
  NotificationSummary,
  NotificationStatus,
} from '../types/notification';

/**
 * Notification Hook
 *
 * Fetches ALL notifications once and filters client-side.
 * This eliminates the loading flash when switching filter tabs.
 * Real-time subscription keeps the list live without re-fetching.
 */

interface UseNotificationsReturn {
  notifications: Notification[];
  allNotifications: Notification[];
  summary: NotificationSummary;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  filters: NotificationFilters;
  setFilters: (filters: NotificationFilters) => void;
}

type NotificationInsertHandler = (notification: Notification) => void;

function calculateSummary(notifs: Notification[]): NotificationSummary {
  const summary: NotificationSummary = {
    total: notifs.length,
    unread: notifs.filter((n) => n.status === 'unread').length,
    byType: {} as any,
    byPriority: {} as any,
  };

  notifs.forEach((notif) => {
    summary.byType[notif.type] = (summary.byType[notif.type] || 0) + 1;
    summary.byPriority[notif.priority] = (summary.byPriority[notif.priority] || 0) + 1;
  });

  return summary;
}

export function useNotifications(
  userId: string,
  onNotificationInsert?: NotificationInsertHandler,
): UseNotificationsReturn {
  // Always holds the FULL unfiltered list fetched from DB
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Client-side filter — no DB round-trip on tab switch
  const [filters, setFilters] = useState<NotificationFilters>({});

  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const hasFetchedRef = useRef(false);

  // ── Fetch ALL notifications (called once on mount, and on manual refresh) ──
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      devLog('[Notifications] Fetching all notifications for user:', userId);

      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        // Table doesn't exist yet
        if (fetchError.message?.includes('does not exist') || fetchError.code === '42P01') {
          devLog('[Notifications] Notifications table not set up yet.');
          setAllNotifications([]);
          setError(null);
          setLoading(false);
          return;
        }
        throw fetchError;
      }

      const notifs = (data || []) as Notification[];
      devLog(`[Notifications] Fetched ${notifs.length} notifications`);
      setAllNotifications(notifs);
      setError(null);
    } catch (err: any) {
      console.error('[Notifications] Fetch failed:', err);
      setError(err);
    } finally {
      setLoading(false);
      hasFetchedRef.current = true;
    }
  }, [userId]);

  // ── Apply client-side filters (instant — no loading) ──
  const notifications = useMemo(() => {
    let result = allNotifications;
    if (filters.status) {
      result = result.filter((n) => n.status === filters.status);
    }
    if (filters.type) {
      result = result.filter((n) => n.type === filters.type);
    }
    if (filters.priority) {
      result = result.filter((n) => n.priority === filters.priority);
    }
    if (filters.startDate) {
      result = result.filter((n) => new Date(n.created_at) >= filters.startDate!);
    }
    if (filters.endDate) {
      result = result.filter((n) => new Date(n.created_at) <= filters.endDate!);
    }
    return result;
  }, [allNotifications, filters]);

  // Summary is always computed from ALL notifications (not the filtered view)
  // so the bell badge always reflects the real unread count
  const summary = useMemo(() => calculateSummary(allNotifications), [allNotifications]);

  // ── Mark as read ──
  const markAsRead = useCallback(async (notificationId: string) => {
    // Optimistic update — instant UI, no loading
    const now = new Date().toISOString();
    setAllNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId
          ? { ...n, status: 'read' as NotificationStatus, read_at: now }
          : n
      )
    );

    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ status: 'read', read_at: now })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (updateError) throw updateError;
    } catch (err: any) {
      // Roll back on failure
      setAllNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, status: 'unread' as NotificationStatus, read_at: undefined }
            : n
        )
      );
      throw err;
    }
  }, [userId]);

  // ── Mark all as read ──
  const markAllAsRead = useCallback(async () => {
    const now = new Date().toISOString();
    // Optimistic
    setAllNotifications((prev) =>
      prev.map((n) =>
        n.status === 'unread'
          ? { ...n, status: 'read' as NotificationStatus, read_at: now }
          : n
      )
    );

    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ status: 'read', read_at: now })
        .eq('user_id', userId)
        .eq('status', 'unread');

      if (updateError) throw updateError;
    } catch (err: any) {
      // Refresh to restore true state
      fetchNotifications();
      throw err;
    }
  }, [userId, fetchNotifications]);

  // ── Delete notification ──
  const deleteNotification = useCallback(async (notificationId: string) => {
    // Optimistic
    setAllNotifications((prev) => prev.filter((n) => n.id !== notificationId));

    try {
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (deleteError) throw deleteError;
    } catch (err: any) {
      fetchNotifications();
      throw err;
    }
  }, [userId, fetchNotifications]);

  // ── Initial fetch + realtime subscription ──
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchNotifications();

    devLog('[Notifications] Setting up realtime subscription');
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          devLog('[Notifications] Realtime:', payload.eventType);

          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new as Notification;
            setAllNotifications((prev) => {
              // Avoid duplicates
              if (prev.some((n) => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });
            onNotificationInsert?.(newNotif);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Notification;
            setAllNotifications((prev) =>
              prev.map((n) => (n.id === updated.id ? updated : n))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Partial<Notification>).id;
            if (deletedId) {
              setAllNotifications((prev) => prev.filter((n) => n.id !== deletedId));
            }
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      devLog('[Notifications] Cleaning up subscription');
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [userId, fetchNotifications, onNotificationInsert]);

  return {
    notifications,
    allNotifications,
    summary,
    loading,
    error,
    refresh: fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    filters,
    setFilters,
  };
}
