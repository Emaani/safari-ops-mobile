/**
 * Shared color constants for the Safari Ops Mobile application
 * Use these colors throughout the app for consistency
 */

export const COLORS = {
  // Primary brand colors
  primary: '#3b82f6',
  primaryLight: '#60a5fa',
  primaryDark: '#2563eb',

  // Semantic colors
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',

  // Accent colors
  purple: '#9333ea',
  income: '#059669',
  expense: '#dc2626',

  // Neutral colors
  background: '#f3f4f6',
  card: '#ffffff',
  text: '#111827',
  textMuted: '#6b7280',
  textLight: '#9ca3af',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',

  // Status colors for bookings/vehicles
  statusColors: {
    confirmed: '#3b82f6',
    'in-progress': '#10b981',
    inProgress: '#10b981',
    completed: '#6b7280',
    pending: '#f59e0b',
    cancelled: '#ef4444',
    available: '#10b981',
    booked: '#3b82f6',
    rented: '#9333ea',
    maintenance: '#f59e0b',
    out_of_service: '#ef4444',
  },
} as const;

export type ColorKey = keyof typeof COLORS;
export type StatusColorKey = keyof typeof COLORS.statusColors;

/**
 * Get status color by status string (case-insensitive)
 */
export function getStatusColor(status: string): string {
  const normalizedStatus = status.toLowerCase().replace(/[^a-z]/g, '');
  const statusMap: Record<string, string> = {
    confirmed: COLORS.statusColors.confirmed,
    inprogress: COLORS.statusColors.inProgress,
    completed: COLORS.statusColors.completed,
    pending: COLORS.statusColors.pending,
    cancelled: COLORS.statusColors.cancelled,
    available: COLORS.statusColors.available,
    booked: COLORS.statusColors.booked,
    rented: COLORS.statusColors.rented,
    maintenance: COLORS.statusColors.maintenance,
    outofservice: COLORS.statusColors.out_of_service,
  };
  return statusMap[normalizedStatus] || COLORS.textMuted;
}

export default COLORS;
