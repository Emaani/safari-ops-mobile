import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Svg, Path, Rect } from 'react-native-svg';
import type { Booking } from '../../types/dashboard';
import { formatCurrency } from '../../lib/utils';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#9333ea',
  background: '#f3f4f6',
  card: '#ffffff',
  text: '#111827',
  textMuted: '#6b7280',
  border: '#e5e7eb',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Confirmed: { bg: '#dbeafe', text: '#1e40af' },
  'In-Progress': { bg: '#dcfce7', text: '#166534' },
  Completed: { bg: '#f3e8ff', text: '#6b21a8' },
  Pending: { bg: '#fef3c7', text: '#92400e' },
  Cancelled: { bg: '#fee2e2', text: '#991b1b' },
};

// ============================================================================
// ICON COMPONENTS
// ============================================================================

function CalendarIcon({ size = 18, color = COLORS.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <Path d="M16 2v4" />
      <Path d="M8 2v4" />
      <Path d="M3 10h18" />
    </Svg>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

interface BookingCardProps {
  booking: Booking & { vehicle?: { name: string } };
  onPress: (booking: Booking) => void;
}

export function BookingCard({ booking, onPress }: BookingCardProps) {
  const statusColors = STATUS_COLORS[booking.status] || STATUS_COLORS.Pending;
  const clientName = booking.client?.company_name || 'Unknown Client';
  const startDate = new Date(booking.start_date).toLocaleDateString();
  const endDate = new Date(booking.end_date).toLocaleDateString();
  const amountPaid = booking.amount_paid || 0;
  const totalCost = booking.total_cost || 0;
  const balance = totalCost - amountPaid;
  const currency = booking.currency || 'USD';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(booking)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <CalendarIcon size={20} color={COLORS.primary} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.bookingNumber}>{booking.booking_number || `#${booking.id.slice(0, 8)}`}</Text>
          <Text style={styles.clientName} numberOfLines={1}>
            {clientName}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusText, { color: statusColors.text }]}>
            {booking.status}
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.dateContainer}>
          <Text style={styles.dateLabel}>Dates</Text>
          <Text style={styles.dateValue}>
            {startDate} - {endDate}
          </Text>
        </View>

        {booking.vehicle && (
          <View style={styles.vehicleContainer}>
            <Text style={styles.vehicleLabel}>Vehicle</Text>
            <Text style={styles.vehicleValue} numberOfLines={1}>
              {booking.vehicle.name}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Total</Text>
          <Text style={styles.amountValue}>{formatCurrency(totalCost, currency)}</Text>
        </View>
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Paid</Text>
          <Text style={[styles.amountValue, { color: COLORS.success }]}>
            {formatCurrency(amountPaid, currency)}
          </Text>
        </View>
        {balance > 0 && (
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Balance</Text>
            <Text style={[styles.amountValue, { color: COLORS.warning }]}>
              {formatCurrency(balance, currency)}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  bookingNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  clientName: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  details: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    marginBottom: 12,
  },
  dateContainer: {
    marginBottom: 8,
  },
  dateLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
  vehicleContainer: {
    marginTop: 4,
  },
  vehicleLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  vehicleValue: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  amountContainer: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
});
