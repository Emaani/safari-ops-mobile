import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Notification,
  NotificationFilters,
  NotificationSummary,
  NotificationStatus,
} from '../types/notification';

/**
 * Notification Hook
 *
 * Provides real-time notifications for the authenticated user.
 * Includes automatic subscription to database changes.
 *
 * Features:
 * - Real-time updates via Supabase subscriptions
 * - Filtering by status, type, priority
 * - Mark as read/unread
 * - Delete notifications
 * - Summary with unread counts
 */

interface UseNotificationsReturn {
  notifications: Notification[];
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

export function useNotifications(userId: string): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<NotificationFilters>({ status: 'unread' });

  const subscriptionRef = useRef<any>(null);

  /**
   * Calculate notification summary
   */
  const calculateSummary = useCallback((notifs: Notification[]): NotificationSummary => {
    const summary: NotificationSummary = {
      total: notifs.length,
      unread: notifs.filter(n => n.status === 'unread').length,
      byType: {} as any,
      byPriority: {} as any,
    };

    notifs.forEach(notif => {
      // Count by type
      if (!summary.byType[notif.type]) {
        summary.byType[notif.type] = 0;
      }
      summary.byType[notif.type]++;

      // Count by priority
      if (!summary.byPriority[notif.priority]) {
        summary.byPriority[notif.priority] = 0;
      }
      summary.byPriority[notif.priority]++;
    });

    return summary;
  }, []);

  /**
   * Fetch notifications from database
   */
  const fetchNotifications = useCallback(async () => {
    try {
      console.log('[Notifications] Fetching notifications for user:', userId);

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.type) {
        query = query.eq('type', filters.type);
      }
      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        // Check if table doesn't exist yet (notifications system not set up)
        if (fetchError.message?.includes('does not exist') || fetchError.code === '42P01') {
          console.warn('[Notifications] Notifications table does not exist yet. Run database migration to enable notifications.');
          setNotifications([]);
          setError(null);
          setLoading(false);
          return;
        }
        console.error('[Notifications] Error fetching notifications:', fetchError);
        throw fetchError;
      }

      const notifs = (data || []) as Notification[];
      console.log(`[Notifications] Fetched ${notifs.length} notifications`);
      setNotifications(notifs);
      setError(null);
    } catch (err: any) {
      console.error('[Notifications] Fetch failed:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [userId, filters]);

  /**
   * Mark notification as read
   */
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      console.log('[Notifications] Marking as read:', notificationId);

      const { error: updateError } = await supabase
        .from('notifications')
        .update({
          status: 'read',
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (updateError) {
        console.error('[Notifications] Error marking as read:', updateError);
        throw updateError;
      }

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, status: 'read' as NotificationStatus, read_at: new Date().toISOString() }
            : n
        )
      );

      console.log('[Notifications] Marked as read successfully');
    } catch (err: any) {
      console.error('[Notifications] Mark as read failed:', err);
      throw err;
    }
  }, [userId]);

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    try {
      console.log('[Notifications] Marking all as read');

      const { error: updateError } = await supabase
        .from('notifications')
        .update({
          status: 'read',
          read_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('status', 'unread');

      if (updateError) {
        console.error('[Notifications] Error marking all as read:', updateError);
        throw updateError;
      }

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.status === 'unread'
            ? { ...n, status: 'read' as NotificationStatus, read_at: new Date().toISOString() }
            : n
        )
      );

      console.log('[Notifications] All marked as read successfully');
    } catch (err: any) {
      console.error('[Notifications] Mark all as read failed:', err);
      throw err;
    }
  }, [userId]);

  /**
   * Delete notification
   */
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      console.log('[Notifications] Deleting notification:', notificationId);

      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (deleteError) {
        console.error('[Notifications] Error deleting notification:', deleteError);
        throw deleteError;
      }

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));

      console.log('[Notifications] Deleted successfully');
    } catch (err: any) {
      console.error('[Notifications] Delete failed:', err);
      throw err;
    }
  }, [userId]);

  /**
   * Initialize notifications and set up real-time subscription
   */
  useEffect(() => {
    if (!userId) {
      console.log('[Notifications] No user ID, skipping fetch');
      return;
    }

    // Initial fetch
    fetchNotifications();

    // Set up real-time subscription
    console.log('[Notifications] Setting up real-time subscription');

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[Notifications] Real-time update received:', payload.eventType);

          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new as Notification;
            setNotifications(prev => [newNotif, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedNotif = payload.new as Notification;
            setNotifications(prev =>
              prev.map(n => (n.id === updatedNotif.id ? updatedNotif : n))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setNotifications(prev => prev.filter(n => n.id !== deletedId));
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    // Cleanup
    return () => {
      console.log('[Notifications] Cleaning up subscription');
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [userId, fetchNotifications]);

  /**
   * Refresh when filters change
   */
  useEffect(() => {
    if (!loading) {
      fetchNotifications();
    }
  }, [filters]);

  const summary = calculateSummary(notifications);

  return {
    notifications,
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
