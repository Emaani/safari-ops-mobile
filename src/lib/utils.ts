import type { Currency, StandardExpenseCategory } from '../types/dashboard';

/**
 * Format currency with proper symbol and locale
 * Matches web Dashboard formatting exactly
 */
export function formatCurrency(amount: number, currency: Currency = 'USD'): string {
  const formatted = Math.round(amount).toLocaleString('en-US');

  switch (currency) {
    case 'USD':
      return `$${formatted}`;
    case 'UGX':
      return `UGX ${formatted}`;
    case 'KES':
      return `KES ${formatted}`;
    default:
      return `$${formatted}`;
  }
}

/**
 * Format currency in compact form for charts (K, M notation)
 */
export function formatCompactCurrency(amount: number, currency: Currency = 'USD'): string {
  const symbol = currency === 'USD' ? '$' : currency;

  if (amount >= 1000000) {
    return `${symbol}${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${symbol}${(amount / 1000).toFixed(1)}K`;
  }
  return `${symbol}${Math.round(amount)}`;
}

/**
 * Normalize expense categories to standard 5 categories
 * Matches web Dashboard normalization logic exactly
 */
export function normalizeExpenseCategory(category: string): StandardExpenseCategory {
  const normalized = category.toLowerCase().trim();

  // Fleet-related
  if (
    normalized.includes('fleet') ||
    normalized.includes('vehicle') ||
    normalized.includes('repair') ||
    normalized.includes('maintenance') ||
    normalized.includes('fuel')
  ) {
    return 'Fleet Supplies';
  }

  // Admin-related
  if (
    normalized.includes('admin') ||
    normalized.includes('office') ||
    normalized.includes('supplies') ||
    normalized.includes('utilities') ||
    normalized.includes('rent')
  ) {
    return 'Admin Costs';
  }

  // Safari-related
  if (
    normalized.includes('safari') ||
    normalized.includes('tour') ||
    normalized.includes('accommodation') ||
    normalized.includes('park fees')
  ) {
    return 'Safari Expense';
  }

  // Petty Cash
  if (normalized.includes('petty') || normalized.includes('cash')) {
    return 'Petty Cash';
  }

  // Default to Operating Expense
  return 'Operating Expense';
}

/**
 * Format date to "DD MMM YYYY" format
 * Matches web Dashboard date formatting
 */
export function formatDateDMY(dateString: string): string {
  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * Normalize vehicle capacity to standard categories
 */
export function normalizeVehicleCapacity(capacity: string): '7 Seater' | '5 Seater' | 'Other' {
  if (!capacity) return 'Other';

  const normalized = capacity.toString().toLowerCase();

  if (normalized.includes('7')) {
    return '7 Seater';
  }
  if (normalized.includes('5')) {
    return '5 Seater';
  }

  return 'Other';
}

/**
 * Get month abbreviation (Jan, Feb, etc.)
 */
export function getMonthAbbreviation(monthIndex: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[monthIndex] || '';
}

/**
 * Check if a date matches the dashboard filter
 */
export function matchesDashboardFilter(
  dateString: string,
  filterMonth: number | 'all',
  filterYear: number
): boolean {
  if (filterMonth === 'all') return true;

  const date = new Date(dateString);
  return date.getMonth() === filterMonth && date.getFullYear() === filterYear;
}

/**
 * Get status badge color matching web Dashboard
 */
export function getStatusColor(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized === 'completed') return '#10b981'; // green
  if (normalized === 'in-progress' || normalized === 'in_progress') return '#f59e0b'; // amber
  if (normalized === 'confirmed') return '#3b82f6'; // blue
  if (normalized === 'pending') return '#6b7280'; // gray
  if (normalized === 'cancelled' || normalized === 'rejected') return '#ef4444'; // red

  return '#6b7280'; // default gray
}
