import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { createNotification, scheduleLocalNotification } from '../services/notificationService';
import { devLog } from '../lib/devLog';
import type { InAppNotif, InAppNotifType } from '../components/system/InAppNotificationBanner';

interface VehicleRow {
  id: string;
  status?: string;
  make?: string;
  model?: string;
  license_plate?: string;
}

interface VehicleTemplate {
  type: InAppNotifType;
  title: string;
  body: (name: string, plate: string) => string;
}

const STATUS_TEMPLATES: Record<string, VehicleTemplate> = {
  maintenance: {
    type:  'vehicle_maintenance',
    title: '🔧 Vehicle Maintenance Required',
    body:  (name, plate) => `${name} (${plate}) has been flagged for maintenance.`,
  },
  available: {
    type:  'vehicle_available',
    title: '✅ Vehicle Now Available',
    body:  (name, plate) => `${name} (${plate}) is now available for booking.`,
  },
  booked: {
    type:  'booking_started',
    title: '🚗 Vehicle Assigned to Booking',
    body:  (name, plate) => `${name} (${plate}) has been assigned to an active booking.`,
  },
};

export function useVehicleNotifications(
  enabled: boolean,
  onInAppNotif: (notif: Omit<InAppNotif, 'id'>) => void,
  notifPrefs?: {
    masterEnabled: boolean;
    vehicleAlerts: boolean;
  },
  userId?: string,
) {
  const channelRef       = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const prevStatusMapRef = useRef<Map<string, string>>(new Map());
  const isCleaningUpRef  = useRef(false);

  const fireNotification = useCallback(async (
    template: VehicleTemplate,
    row: VehicleRow,
  ) => {
    const name = `${row.make ?? ''} ${row.model ?? ''}`.trim() || 'Vehicle';
    const plate = row.license_plate || row.id.slice(0, 8).toUpperCase();
    const body  = template.body(name, plate);

    await scheduleLocalNotification(template.title, body, {
      vehicle_id: row.id,
      screen: 'Fleet',
    }).catch(console.error);

    onInAppNotif({
      type:   template.type,
      title:  template.title,
      body,
      screen: 'Fleet',
    });

    if (userId) {
      await createNotification({
        userId,
        type:     template.type === 'vehicle_maintenance' ? 'vehicle_maintenance' : 'vehicle_available',
        title:    template.title,
        message:  body,
        priority: template.type === 'vehicle_maintenance' ? 'high' : 'medium',
        data: { vehicle_id: row.id, screen: 'Fleet', suppress_banner: true },
      }).catch((e) => console.error('[VehicleNotif] persist failed:', e));
    }
  }, [onInAppNotif, userId]);

  const handleUpdate = useCallback(async (
    oldRow: Partial<VehicleRow>,
    newRow: VehicleRow,
  ) => {
    if (notifPrefs && (!notifPrefs.masterEnabled || !notifPrefs.vehicleAlerts)) return;

    const prevStatus = oldRow.status ?? prevStatusMapRef.current.get(newRow.id);
    const newStatus  = newRow.status;
    if (!newStatus || newStatus === prevStatus) return;

    prevStatusMapRef.current.set(newRow.id, newStatus);
    const template = STATUS_TEMPLATES[newStatus];
    if (!template) return;

    devLog(`[VehicleNotif] UPDATE ${prevStatus} → ${newStatus} for`, newRow.license_plate);
    await fireNotification(template, newRow);
  }, [fireNotification, notifPrefs]);

  useEffect(() => {
    if (!enabled) return;

    isCleaningUpRef.current = false;
    devLog('[VehicleNotif] Subscribing to vehicles realtime…');

    const channel = supabase
      .channel('vehicle-status-notifs')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'vehicles' },
        (payload) => {
          if (isCleaningUpRef.current) return;
          handleUpdate(
            payload.old as Partial<VehicleRow>,
            payload.new as VehicleRow,
          ).catch(console.error);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') devLog('[VehicleNotif] ✓ Subscribed');
        else if (status === 'CHANNEL_ERROR') console.warn('[VehicleNotif] Channel error');
      });

    channelRef.current = channel;

    return () => {
      isCleaningUpRef.current = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, handleUpdate]);
}
