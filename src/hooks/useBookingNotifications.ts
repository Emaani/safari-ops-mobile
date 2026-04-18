import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { createNotification, scheduleLocalNotification } from '../services/notificationService';
import { devLog } from '../lib/devLog';
import type { InAppNotif, InAppNotifType } from '../components/system/InAppNotificationBanner';

// ─── Booking event definitions ─────────────────────────────────────────────────

interface BookingRow {
  id: string;
  status?: string;
  booking_reference?: string;
  client_name?: string;
  start_date?: string;
}

interface NotifTemplate {
  title: string;
  type: InAppNotifType;
  body: (ref: string, client: string) => string;
}

const INSERT_TEMPLATE: NotifTemplate = {
  type:  'booking_new',
  title: '📋 New Booking Created',
  body:  (ref, client) =>
    client ? `New booking ${ref} for ${client}.` : `New booking ${ref} has been created.`,
};

const STATUS_TEMPLATES: Record<string, NotifTemplate> = {
  'In-Progress': {
    type:  'booking_started',
    title: '🚗 Safari Started',
    body:  (ref, client) =>
      client ? `Booking ${ref} for ${client} is now in progress.` : `Booking ${ref} has started.`,
  },
  'Completed': {
    type:  'booking_completed',
    title: '✅ Booking Completed',
    body:  (ref, client) =>
      client ? `Booking ${ref} for ${client} is complete.` : `Booking ${ref} completed.`,
  },
  'Confirmed': {
    type:  'booking_confirmed',
    title: '🎉 Booking Confirmed',
    body:  (ref, client) =>
      client ? `Booking ${ref} for ${client} is confirmed.` : `Booking ${ref} confirmed.`,
  },
  'Cancelled': {
    type:  'booking_cancelled',
    title: '❌ Booking Cancelled',
    body:  (ref, client) =>
      client ? `Booking ${ref} for ${client} was cancelled.` : `Booking ${ref} cancelled.`,
  },
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Subscribes to the `bookings` table via Supabase realtime and:
 *  1. Fires an OS push notification (works when app is in background)
 *  2. Calls onInAppNotif so the InAppNotificationBanner can show while foregrounded
 *
 * notifPrefs gates which specific event types are allowed.
 */
export function useBookingNotifications(
  enabled: boolean,
  onInAppNotif: (notif: Omit<InAppNotif, 'id'>) => void,
  notifPrefs?: {
    masterEnabled:    boolean;
    bookingNew:       boolean;
    bookingStarted:   boolean;
    bookingCompleted: boolean;
    bookingCancelled: boolean;
  },
  userId?: string,
) {
  const channelRef       = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const prevStatusMapRef = useRef<Map<string, string>>(new Map());
  const isCleaningUpRef  = useRef(false);

  const fireNotification = useCallback(async (
    template: NotifTemplate,
    ref: string,
    client: string,
    bookingId: string,
  ) => {
    const body = template.body(ref, client);

    // OS / push notification (shows even when app is in background)
    await scheduleLocalNotification(template.title, body, {
      booking_id: bookingId,
      screen: 'Bookings',
    }).catch(console.error);

    // In-app banner (only visible when foregrounded)
    onInAppNotif({
      type:   template.type,
      title:  template.title,
      body,
      screen: 'Bookings',
    });

    if (userId) {
      await createNotification({
        userId,
        type: template.type === 'booking_completed'
          ? 'booking_completed'
          : template.type === 'booking_cancelled'
          ? 'booking_cancelled'
          : 'booking_created',
        title: template.title,
        message: body,
        priority: template.type === 'booking_cancelled' ? 'high' : 'medium',
        data: {
          booking_id: bookingId,
          reference: ref,
          screen: 'Bookings',
          suppress_banner: true,
        },
      }).catch((error) => {
        console.error('[BookingNotif] Failed to persist notification:', error);
      });
    }
  }, [onInAppNotif, userId]);

  const handleInsert = useCallback(async (row: BookingRow) => {
    if (notifPrefs && (!notifPrefs.masterEnabled || !notifPrefs.bookingNew)) return;
    const ref    = row.booking_reference || row.id.slice(0, 8).toUpperCase();
    const client = row.client_name || '';
    devLog('[BookingNotif] INSERT →', ref);
    await fireNotification(INSERT_TEMPLATE, ref, client, row.id);
  }, [fireNotification, notifPrefs]);

  const handleUpdate = useCallback(async (
    oldRow: Partial<BookingRow>,
    newRow: BookingRow,
  ) => {
    const prevStatus = oldRow.status ?? prevStatusMapRef.current.get(newRow.id);
    const newStatus  = newRow.status;
    if (!newStatus || newStatus === prevStatus) return;

    prevStatusMapRef.current.set(newRow.id, newStatus);
    const template = STATUS_TEMPLATES[newStatus];
    if (!template) return;

    // Check per-event-type user preference
    if (notifPrefs && !notifPrefs.masterEnabled) return;
    if (notifPrefs) {
      if (newStatus === 'In-Progress'  && !notifPrefs.bookingStarted)   return;
      if (newStatus === 'Completed'    && !notifPrefs.bookingCompleted)  return;
      if (newStatus === 'Cancelled'    && !notifPrefs.bookingCancelled)  return;
    }

    const ref    = newRow.booking_reference || newRow.id.slice(0, 8).toUpperCase();
    const client = newRow.client_name || '';
    devLog(`[BookingNotif] UPDATE ${prevStatus} → ${newStatus} for`, ref);
    await fireNotification(template, ref, client, newRow.id);
  }, [fireNotification, notifPrefs]);

  useEffect(() => {
    if (!enabled) return;

    isCleaningUpRef.current = false;
    devLog('[BookingNotif] Subscribing to bookings realtime…');

    const channel = supabase
      .channel('booking-lifecycle-notifs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bookings' },
        (payload) => {
          if (isCleaningUpRef.current) return;
          handleInsert(payload.new as BookingRow).catch(console.error);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings' },
        (payload) => {
          if (isCleaningUpRef.current) return;
          handleUpdate(
            payload.old as Partial<BookingRow>,
            payload.new as BookingRow,
          ).catch(console.error);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          devLog('[BookingNotif] ✓ Subscribed');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('[BookingNotif] Channel error');
        }
      });

    channelRef.current = channel;

    return () => {
      isCleaningUpRef.current = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, handleInsert, handleUpdate]);
}
