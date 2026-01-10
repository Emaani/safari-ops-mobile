import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Svg, Path, Circle } from 'react-native-svg';
import type { Vehicle } from '../../types/dashboard';

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
  available: { bg: '#dcfce7', text: '#166534' },
  booked: { bg: '#dbeafe', text: '#1e40af' },
  rented: { bg: '#e0e7ff', text: '#3730a3' },
  maintenance: { bg: '#fef3c7', text: '#92400e' },
  out_of_service: { bg: '#fee2e2', text: '#991b1b' },
};

// ============================================================================
// ICON COMPONENT
// ============================================================================

function TruckIcon({ size = 20, color = COLORS.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 3h15v13H1z" />
      <Path d="M16 8h4l3 3v5h-7V8z" />
      <Circle cx="5.5" cy="18.5" r="2.5" />
      <Circle cx="18.5" cy="18.5" r="2.5" />
    </Svg>
  );
}

function StarIcon({ size = 14, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#f59e0b' : 'none'} stroke="#f59e0b" strokeWidth={2}>
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

interface VehicleCardProps {
  vehicle: Vehicle;
  onPress: (vehicle: Vehicle) => void;
}

export function VehicleCard({ vehicle, onPress }: VehicleCardProps) {
  const statusColors = STATUS_COLORS[vehicle.status] || STATUS_COLORS.available;
  const vehicleName = `${vehicle.make} ${vehicle.model}`;
  const capacity = vehicle.capacity?.replace('_', ' ').replace('seater', ' Seater') || 'N/A';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(vehicle)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <TruckIcon size={20} color={COLORS.primary} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.licensePlate}>{vehicle.license_plate}</Text>
          <Text style={styles.vehicleName} numberOfLines={1}>
            {vehicleName}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusText, { color: statusColors.text }]}>
            {vehicle.status?.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Capacity</Text>
          <Text style={styles.detailValue}>{capacity}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Driver</Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {vehicle.drivers?.full_name || 'Unassigned'}
          </Text>
        </View>
        {vehicle.rating !== undefined && vehicle.rating > 0 && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Rating</Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <StarIcon key={star} size={12} filled={star <= (vehicle.rating || 0)} />
              ))}
            </View>
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
  licensePlate: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  vehicleName: {
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
    textTransform: 'capitalize',
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    gap: 16,
  },
  detailItem: {
    minWidth: 80,
  },
  detailLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 2,
  },
});
