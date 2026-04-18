import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { createNotification, scheduleLocalNotification } from '../services/notificationService';
import { devLog } from '../lib/devLog';
import type { InAppNotif, InAppNotifType } from '../components/system/InAppNotificationBanner';

// ─── CR row shape from Supabase realtime payload ──────────────────────────────

interface CRRow {
  id: string;
  cr_number?: string;
  status?: string;
  expense_category?: string;
  total_cost?: number;
  currency?: string;
  requested_by?: string;
  assigned_to?: string;
  description?: string;
}

// ─── Notification templates ────────────────────────────────────────────────────

interface CRNotifTemplate {
  type:  InAppNotifType;
  title: string;
  body:  (cr: string, category: string, requestedBy: string) => string;
}

const INSERT_TEMPLATE: CRNotifTemplate = {
  type:  'cr_raised',
  title: '📝 New Cash Requisition',
  body:  (cr, category, by) =>
    by
      ? `${by} raised CR ${cr} for ${category}.`
      : `New cash requisition ${cr} raised for ${category}.`,
};

const STATUS_TEMPLATES: Record<string, CRNotifTemplate> = {
  Approved: {
    type:  'cr_approved',
    title: '✅ Cash Requisition Approved',
    body:  (cr, category) => `CR ${cr} (${category}) has been approved and is ready for disbursement.`,
  },
  Assigned: {
    type:  'cr_assigned',
    title: '📌 Cash Requisition Assigned',
    body:  (cr, category) => `CR ${cr} (${category}) has been assigned for action.`,
  },
  Completed: {
    type:  'cr_completed',
    title: '💵 Cash Requisition Completed',
    body:  (cr, category) => `CR ${cr} (${category}) has been completed and funds disbursed.`,
  },
  Resolved: {
    type:  'cr_completed',
    title: '💵 Cash Requisition Resolved',
    body:  (cr, category) => `CR ${cr} (${category}) has been resolved.`,
  },
  Rejected: {
    type:  'cr_rejected',
    title: '❌ Cash Requisition Rejected',
    body:  (cr, category) => `CR ${cr} (${category}) was rejected. Please review and resubmit.`,
  },
  Declined: {
    type:  'cr_rejected',
    title: '❌ Cash Requisition Declined',
    body:  (cr, category) => `CR ${cr} (${category}) has been declined.`,
  },
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Subscribes to the `cash_requisitions` table via Supabase realtime and:
 *  1. Fires an OS push notification (visible in background)
 *  2. Calls onInAppNotif so InAppNotificationBanner shows while foregrounded
 *
 * Triggers on:
 *  INSERT  → "New Cash Requisition raised"
 *  UPDATE  → status changes: Approved, Completed, Resolved, Rejected, Declined
 */
export function useCRNotifications(
  enabled: boolean,
  onInAppNotif: (notif: Omit<InAppNotif, 'id'>) => void,
  notifPrefs?: {
    masterEnabled: boolean;
    crNew:         boolean;
    crApproved:    boolean;
  },
  userId?: string,
) {
  const channelRef       = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const prevStatusMapRef = useRef<Map<string, string>>(new Map());
  const isCleaningUpRef  = useRef(false);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const crRef = useCallback((row: CRRow): string =>
    row.cr_number || row.id.slice(0, 8).toUpperCase()
  , []);

  const fireNotification = useCallback(async (
    template: CRNotifTemplate,
    row: CRRow,
  ) => {
    const ref      = crRef(row);
    const category = row.expense_category || 'General';
    const by       = row.requested_by     || '';
    const body     = template.body(ref, category, by);

    // OS push (shows in background / lock screen)
    await scheduleLocalNotification(template.title, body, {
      cr_id:  row.id,
      screen: 'Finance',
    }).catch(console.error);

    // In-app banner (shows when foregrounded)
    onInAppNotif({
      type:   template.type,
      title:  template.title,
      body,
      screen: 'Finance',
    });

    if (userId) {
      await createNotification({
        userId,
        type: template.type === 'cr_approved'
          ? 'cr_approved'
          : template.type === 'cr_rejected'
          ? 'cr_rejected'
          : 'cr_created',
        title: template.title,
        message: body,
        priority: template.type === 'cr_rejected' ? 'high' : 'medium',
        data: {
          cr_id: row.id,
          reference: ref,
          screen: 'Finance',
          amount: row.total_cost,
          currency: row.currency,
          suppress_banner: true,
        },
      }).catch((error) => {
        console.error('[CRNotif] Failed to persist notification:', error);
      });
    }
  }, [crRef, onInAppNotif, userId]);

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleInsert = useCallback(async (row: CRRow) => {
    if (notifPrefs && (!notifPrefs.masterEnabled || !notifPrefs.crNew)) return;
    devLog('[CRNotif] INSERT →', crRef(row));
    await fireNotification(INSERT_TEMPLATE, row);
  }, [crRef, fireNotification, notifPrefs]);

  const handleUpdate = useCallback(async (
    oldRow: Partial<CRRow>,
    newRow: CRRow,
  ) => {
    if (notifPrefs && !notifPrefs.masterEnabled) return;
    const prevStatus = oldRow.status ?? prevStatusMapRef.current.get(newRow.id);
    const newStatus  = newRow.status;
    if (!newStatus || newStatus === prevStatus) return;

    prevStatusMapRef.current.set(newRow.id, newStatus);
    const template = STATUS_TEMPLATES[newStatus];
    if (!template) return;

    if (notifPrefs && newStatus === 'Approved' && !notifPrefs.crApproved) return;

    devLog(`[CRNotif] UPDATE ${prevStatus} → ${newStatus} for`, crRef(newRow));
    await fireNotification(template, newRow);
  }, [crRef, fireNotification, notifPrefs]);

  // ── Subscription ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;

    isCleaningUpRef.current = false;
    devLog('[CRNotif] Subscribing to cash_requisitions realtime…');

    const channel = supabase
      .channel('cr-lifecycle-notifs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cash_requisitions' },
        (payload) => {
          if (isCleaningUpRef.current) return;
          handleInsert(payload.new as CRRow).catch(console.error);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cash_requisitions' },
        (payload) => {
          if (isCleaningUpRef.current) return;
          handleUpdate(
            payload.old as Partial<CRRow>,
            payload.new as CRRow,
          ).catch(console.error);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          devLog('[CRNotif] ✓ Subscribed to cash_requisitions channel');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('[CRNotif] Channel error — CR notifications may be delayed');
        }
      });

    channelRef.current = channel;

    return () => {
      isCleaningUpRef.current = true;
      devLog('[CRNotif] Cleaning up subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, handleInsert, handleUpdate]);
}
