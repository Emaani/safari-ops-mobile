/**
 * Shared constants for Safari Ops Mobile
 */

export { COLORS, getStatusColor } from './colors';
export type { ColorKey, StatusColorKey } from './colors';

/**
 * Currency options for pickers
 */
export const CURRENCIES = [
  { label: 'USD ($)', value: 'USD' as const },
  { label: 'UGX', value: 'UGX' as const },
  { label: 'KES', value: 'KES' as const },
];

/**
 * Month options for pickers
 */
export const MONTHS = [
  { label: 'January', value: 0 },
  { label: 'February', value: 1 },
  { label: 'March', value: 2 },
  { label: 'April', value: 3 },
  { label: 'May', value: 4 },
  { label: 'June', value: 5 },
  { label: 'July', value: 6 },
  { label: 'August', value: 7 },
  { label: 'September', value: 8 },
  { label: 'October', value: 9 },
  { label: 'November', value: 10 },
  { label: 'December', value: 11 },
];

/**
 * Generate years from 2020 to current year + 1
 */
export const generateYears = (): { label: string; value: number }[] => {
  const thisYear = new Date().getFullYear();
  const years: { label: string; value: number }[] = [];
  for (let year = thisYear + 1; year >= 2020; year--) {
    years.push({ label: String(year), value: year });
  }
  return years;
};

export const YEARS = generateYears();

/**
 * Booking status filter options
 */
export const BOOKING_STATUS_FILTERS = [
  { label: 'All', value: 'all' as const },
  { label: 'Confirmed', value: 'Confirmed' as const },
  { label: 'In-Progress', value: 'In-Progress' as const },
  { label: 'Completed', value: 'Completed' as const },
  { label: 'Pending', value: 'Pending' as const },
];

/**
 * Vehicle status filter options
 */
export const VEHICLE_STATUS_FILTERS = [
  { label: 'All', value: 'all' as const },
  { label: 'Available', value: 'available' as const },
  { label: 'Booked', value: 'booked' as const },
  { label: 'Rented', value: 'rented' as const },
  { label: 'Maintenance', value: 'maintenance' as const },
  { label: 'Out of Service', value: 'out_of_service' as const },
];
