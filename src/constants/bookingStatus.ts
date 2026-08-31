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
    bg:       '#FEF3DC',
    text:     '#7a5000',
    dot:      '#F5A623',
    label:    'Pending',
    editable: true,
  },
  Confirmed: {
    bg:       '#FEF0DC',
    text:     '#8B6B3E',
    dot:      '#8B6B3E',
    label:    'Confirmed',
    editable: true,
  },
  'In-Progress': {
    bg:       '#E8F7EE',
    text:     '#1A6B3C',
    dot:      '#34A853',
    label:    'In Progress',
    editable: true,
  },
  Completed: {
    bg:       '#EDE8FE',
    text:     '#5436CC',
    dot:      '#7A5AF8',
    label:    'Completed',
    editable: false,
  },
  Cancelled: {
    bg:       '#FFEEED',
    text:     '#CC1400',
    dot:      '#FF3B30',
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
