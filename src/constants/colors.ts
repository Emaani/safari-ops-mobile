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
  success: '#34A853',
  warning: '#F5A623',
  danger: '#FF3B30',
  info: '#3b82f6',

  // Accent colors
  purple: '#7A5AF8',
  income: '#34A853',
  expense: '#FF3B30',

  // Neutral colors
  background: '#F2F2F7',
  card: '#ffffff',
  text: '#1C1C1E',
  textMuted: '#6C6C70',
  textLight: '#AEAEB2',
  border: '#E5E5EA',
  borderLight: '#F2F2F7',

  // Status colors for bookings/vehicles
  statusColors: {
    confirmed: '#8B6B3E',
    'in-progress': '#34A853',
    inProgress: '#34A853',
    completed: '#7A5AF8',
    pending: '#F5A623',
    cancelled: '#FF3B30',
    available: '#34A853',
    booked: '#8B6B3E',
    rented: '#7A5AF8',
    maintenance: '#F5A623',
    out_of_service: '#FF3B30',
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
