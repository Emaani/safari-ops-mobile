import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Svg, Path, Circle, Line } from 'react-native-svg';
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
// ICON COMPONENTS
// ============================================================================

function CloseIcon({ size = 24, color = COLORS.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}

function TruckIcon({ size = 24, color = COLORS.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M1 3h15v13H1z" />
      <Path d="M16 8h4l3 3v5h-7V8z" />
      <Circle cx="5.5" cy="18.5" r="2.5" />
      <Circle cx="18.5" cy="18.5" r="2.5" />
    </Svg>
  );
}

function StarIcon({ size = 16, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#f59e0b' : 'none'} stroke="#f59e0b" strokeWidth={2}>
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

interface VehicleDetailModalProps {
  vehicle: Vehicle | null;
  visible: boolean;
  onClose: () => void;
}

export function VehicleDetailModal({ vehicle, visible, onClose }: VehicleDetailModalProps) {
  if (!vehicle) return null;

  const statusColors = STATUS_COLORS[vehicle.status] || STATUS_COLORS.available;
  const vehicleName = `${vehicle.make} ${vehicle.model}`;
  const capacity = vehicle.capacity?.replace('_', ' ').replace('seater', ' Seater') || 'N/A';

  // Extended vehicle properties (cast to any for optional fields)
  const extVehicle = vehicle as any;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'N/A';
    return `$${amount.toLocaleString()}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconContainer}>
              <TruckIcon size={24} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.headerTitle}>{vehicle.license_plate}</Text>
              <Text style={styles.headerSubtitle}>{vehicleName}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <CloseIcon size={24} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Status Badge */}
          <View style={styles.statusSection}>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {vehicle.status?.replace('_', ' ')}
              </Text>
            </View>
            {vehicle.rating !== undefined && vehicle.rating > 0 && (
              <View style={styles.ratingContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <StarIcon key={star} size={16} filled={star <= (vehicle.rating || 0)} />
                ))}
              </View>
            )}
          </View>

          {/* Basic Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle Information</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Make</Text>
                <Text style={styles.infoValue}>{vehicle.make}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Model</Text>
                <Text style={styles.infoValue}>{vehicle.model}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Year</Text>
                <Text style={styles.infoValue}>{extVehicle.year || 'N/A'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Capacity</Text>
                <Text style={styles.infoValue}>{capacity}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Fuel Type</Text>
                <Text style={styles.infoValue}>{extVehicle.fuel_type || 'N/A'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Color</Text>
                <Text style={styles.infoValue}>{extVehicle.color || 'N/A'}</Text>
              </View>
            </View>
          </View>

          {/* Driver Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Driver</Text>
            <View style={styles.driverCard}>
              <Text style={styles.driverName}>
                {vehicle.drivers?.full_name || 'Unassigned'}
              </Text>
            </View>
          </View>

          {/* Rates Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Daily Rates</Text>
            <View style={styles.ratesGrid}>
              <View style={styles.rateItem}>
                <Text style={styles.rateLabel}>USD</Text>
                <Text style={styles.rateValue}>{formatCurrency(extVehicle.daily_rate_usd)}</Text>
              </View>
              <View style={styles.rateItem}>
                <Text style={styles.rateLabel}>UGX</Text>
                <Text style={styles.rateValue}>
                  {extVehicle.daily_rate_ugx ? `UGX ${extVehicle.daily_rate_ugx.toLocaleString()}` : 'N/A'}
                </Text>
              </View>
            </View>
          </View>

          {/* Service Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Information</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Odometer</Text>
                <Text style={styles.infoValue}>
                  {extVehicle.odometer ? `${extVehicle.odometer.toLocaleString()} km` : 'N/A'}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Last Service</Text>
                <Text style={styles.infoValue}>{formatDate(extVehicle.last_service_date)}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Next Service</Text>
                <Text style={styles.infoValue}>{formatDate(extVehicle.next_service_date)}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Insurance Expiry</Text>
                <Text style={styles.infoValue}>{formatDate(extVehicle.insurance_expiry)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  section: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    width: '50%',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  driverCard: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  ratesGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  rateItem: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  rateLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  rateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  bottomSpacer: {
    height: 32,
  },
});
