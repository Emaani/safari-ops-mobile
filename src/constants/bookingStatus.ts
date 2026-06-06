/**
 * bookingStatus.ts — single source of truth for booking status configuration.
 *
 * Used by: BookingCard, BookingDetailModal, EditBookingModal, NewBookingModal,
 *          BookingsScreen, DashboardScreen widgets, Safari screens.
 *
 * Importing from this file ensures color, label, and editability rules are
 * identical across every surface — mobile app and dashboard alike.
 */

import type { BookingStatus } from '../types/dashboard';

// ─── Status config ─────────────────────────────────────────────────────────
export interface BookingStatusConfig {
  /** Pill background */
  bg:       string;
  /** Pill text color */
  text:     string;
  /** Accent dot / progress fill */
  dot:      string;
  /** Display label */
  label:    string;
  /**
   * Whether users may open the Edit form for this status.
   * Completed and Cancelled bookings are locked to preserve
   * operational integrity and historical accuracy.
   */
  editable: boolean;
}

export const BOOKING_STATUS_CONFIG: Record<BookingStatus, BookingStatusConfig> = {
  Pending: {
    bg:       '#fef3c7',
    text:     '#92400e',
    dot:      '#d97706',
    label:    'Pending',
    editable: true,
  },
  Confirmed: {
    bg:       '#dbeafe',
    text:     '#1e40af',
    dot:      '#3b82f6',
    label:    'Confirmed',
    editable: true,
  },
  'In-Progress': {
    bg:       '#dcfce7',
    text:     '#166534',
    dot:      '#16a34a',
    label:    'In Progress',
    editable: true,
  },
  Completed: {
    bg:       '#f3e8ff',
    text:     '#6b21a8',
    dot:      '#9333ea',
    label:    'Completed',
    editable: false,
  },
  Cancelled: {
    bg:       '#fee2e2',
    text:     '#991b1b',
    dot:      '#ef4444',
    label:    'Cancelled',
    editable: false,
  },
};

/** Fallback for unknown statuses */
export const DEFAULT_STATUS_CONFIG: BookingStatusConfig = BOOKING_STATUS_CONFIG.Pending;

/** Helper — returns config for a given status string */
export function getBookingStatusConfig(status: string): BookingStatusConfig {
  return BOOKING_STATUS_CONFIG[status as BookingStatus] ?? DEFAULT_STATUS_CONFIG;
}

/** Statuses the current booking may transition to when editing */
export const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  Pending:       ['Pending', 'Confirmed', 'In-Progress', 'Cancelled'],
  Confirmed:     ['Confirmed', 'In-Progress', 'Cancelled'],
  'In-Progress': ['In-Progress', 'Completed', 'Cancelled'],
  Completed:     [],
  Cancelled:     [],
};
