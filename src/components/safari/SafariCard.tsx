import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Svg, Path, Circle } from 'react-native-svg';
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
  safari: '#059669',
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
};

// ============================================================================
// ICON COMPONENTS
// ============================================================================

function CompassIcon({ size = 18, color = COLORS.safari }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
    </Svg>
  );
}

function MapPinIcon({ size = 14, color = COLORS.textMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx="12" cy="10" r="3" />
    </Svg>
  );
}

function UsersIcon({ size = 14, color = COLORS.textMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

interface SafariCardProps {
  safari: Booking & { vehicle?: { name: string }; destination?: string; pax_count?: number };
  onPress: (safari: Booking) => void;
}

export function SafariCard({ safari, onPress }: SafariCardProps) {
  const statusColors = STATUS_COLORS[safari.status] || STATUS_COLORS.Confirmed;
  const clientName = safari.client?.company_name || 'Unknown Client';
  const startDate = new Date(safari.start_date).toLocaleDateString();
  const endDate = new Date(safari.end_date).toLocaleDateString();
  const extSafari = safari as any;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(safari)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <CompassIcon size={20} color={COLORS.safari} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.bookingNumber}>{safari.booking_number || `#${safari.id.slice(0, 8)}`}</Text>
          <Text style={styles.clientName} numberOfLines={1}>
            {clientName}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusText, { color: statusColors.text }]}>
            {safari.status}
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>Safari Period</Text>
          <Text style={styles.dateValue}>
            {startDate} - {endDate}
          </Text>
        </View>

        <View style={styles.infoRow}>
          {extSafari.destination && (
            <View style={styles.infoItem}>
              <MapPinIcon size={14} color={COLORS.textMuted} />
              <Text style={styles.infoText} numberOfLines={1}>
                {extSafari.destination}
              </Text>
            </View>
          )}
          {extSafari.pax_count && (
            <View style={styles.infoItem}>
              <UsersIcon size={14} color={COLORS.textMuted} />
              <Text style={styles.infoText}>
                {extSafari.pax_count} pax
              </Text>
            </View>
          )}
        </View>

        {safari.vehicle && (
          <View style={styles.vehicleRow}>
            <Text style={styles.vehicleLabel}>Vehicle</Text>
            <Text style={styles.vehicleValue} numberOfLines={1}>
              {safari.vehicle.name}
            </Text>
          </View>
        )}

        {safari.profiles?.full_name && (
          <View style={styles.driverRow}>
            <Text style={styles.driverLabel}>Driver/Guide</Text>
            <Text style={styles.driverValue}>
              {safari.profiles.full_name}
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
    borderLeftWidth: 4,
    borderLeftColor: COLORS.safari,
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
    backgroundColor: '#d1fae5',
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
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  dateRow: {
    marginBottom: 10,
  },
  dateLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  vehicleRow: {
    marginBottom: 6,
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
  driverRow: {
    marginTop: 4,
  },
  driverLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  driverValue: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
});
