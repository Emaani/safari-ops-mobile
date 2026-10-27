import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Svg, Path, Circle, Line } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import type { Vehicle } from '../../types/dashboard';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary:    '#8B6B3E',
  gold:       '#C6A563',
  success:    '#34A853',
  warning:    '#F5A623',
  danger:     '#FF3B30',
  purple:     '#7A5AF8',
  background: '#F2F2F7',
  card:       '#FFFFFF',
  text:       '#1C1C1E',
  textMuted:  '#6C6C70',
  border:     '#E5E5EA',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  available:     { bg: '#E8F7EE', text: '#1A6B3C' },
  booked:        { bg: '#EDE8FE', text: '#5436CC' },
  rented:        { bg: '#FEF0DC', text: '#8B6B3E' },
  maintenance:   { bg: '#FEF3DC', text: '#7a5000' },
  out_of_service:{ bg: '#FFEEED', text: '#CC1400' },
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
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#C6A563' : 'none'} stroke="#C6A563" strokeWidth={2}>
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
  onUpdated?: () => void;
}

function vehicleStatusLabel(status: string | undefined, t: (key: string) => string): string {
  const map: Record<string, string> = {
    available: 'fleet.available', booked: 'fleet.statusBooked', rented: 'fleet.statusRented',
    maintenance: 'fleet.maintenance', out_of_service: 'fleet.statusOutOfService',
  };
  const k = status ? map[status] : undefined;
  return k ? t(k) : (status?.replace('_', ' ') || '');
}

export function VehicleDetailModal({ vehicle, visible, onClose, onUpdated }: VehicleDetailModalProps) {
  const { t } = useAppPreferences();
  const [editingOdo, setEditingOdo] = useState(false);
  const [odoInput,   setOdoInput]   = useState('');
  const [saving,     setSaving]     = useState(false);

  if (!vehicle) return null;

  const openOdoEditor = () => {
    const current = (vehicle as any).odometer;
    setOdoInput(current != null ? String(current) : '');
    setEditingOdo(true);
  };

  const saveOdometer = async () => {
    const value = parseInt(odoInput.replace(/[^\d]/g, ''), 10);
    if (isNaN(value) || value < 0) {
      Alert.alert(t('vehicleDetail.invalidReadingTitle'), t('vehicleDetail.invalidReadingMsg'));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ odometer: value, odometer_updated_at: new Date().toISOString() })
        .eq('id', vehicle.id);
      if (error) throw error;
      setEditingOdo(false);
      onUpdated?.();
    } catch (e: any) {
      Alert.alert(t('vehicleDetail.updateFailedTitle'), e?.message || t('vehicleDetail.updateFailedMsg'));
    } finally {
      setSaving(false);
    }
  };

  const statusColors = STATUS_COLORS[vehicle.status] || STATUS_COLORS.available;
  const vehicleName = `${vehicle.make} ${vehicle.model}`;
  const capacity = vehicle.capacity?.replace('_', ' ').replace('seater', ' Seater') || t('vehicleDetail.naLabel');

  // Extended vehicle properties (cast to any for optional fields)
  const extVehicle = vehicle as any;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return t('vehicleDetail.naLabel');
    return new Date(dateStr).toLocaleDateString();
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return t('vehicleDetail.naLabel');
    return `$${amount.toLocaleString()}`;
  };

  const isOverdueOrSoon = (dateStr?: string) => {
    if (!dateStr) return false;
    const days = (new Date(dateStr).getTime() - Date.now()) / 86400000;
    return days <= 30;
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
                {vehicleStatusLabel(vehicle.status, t)}
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
            <Text style={styles.sectionTitle}>{t('vehicleDetail.vehicleInfoTitle')}</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('vehicleDetail.makeLabel')}</Text>
                <Text style={styles.infoValue}>{vehicle.make}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('vehicleDetail.modelLabel')}</Text>
                <Text style={styles.infoValue}>{vehicle.model}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('vehicleDetail.yearLabel')}</Text>
                <Text style={styles.infoValue}>{extVehicle.year || t('vehicleDetail.naLabel')}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('vehicleDetail.capacityLabel')}</Text>
                <Text style={styles.infoValue}>{capacity}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('vehicleDetail.fuelTypeLabel')}</Text>
                <Text style={styles.infoValue}>{extVehicle.fuel_type || t('vehicleDetail.naLabel')}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('vehicleDetail.colorLabel')}</Text>
                <Text style={styles.infoValue}>{extVehicle.color || t('vehicleDetail.naLabel')}</Text>
              </View>
            </View>
          </View>

          {/* Driver Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('vehicleDetail.currentDriverTitle')}</Text>
            <View style={styles.driverCard}>
              <Text style={styles.driverName}>
                {vehicle.drivers?.full_name || t('bookingDetail.unassignedLabel')}
              </Text>
            </View>
          </View>

          {/* Rates Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('vehicleDetail.dailyRatesTitle')}</Text>
            <View style={styles.ratesGrid}>
              <View style={styles.rateItem}>
                <Text style={styles.rateLabel}>USD</Text>
                <Text style={styles.rateValue}>{formatCurrency(extVehicle.daily_rate_usd)}</Text>
              </View>
              <View style={styles.rateItem}>
                <Text style={styles.rateLabel}>UGX</Text>
                <Text style={styles.rateValue}>
                  {extVehicle.daily_rate_ugx ? `UGX ${extVehicle.daily_rate_ugx.toLocaleString()}` : t('vehicleDetail.naLabel')}
                </Text>
              </View>
            </View>
          </View>

          {/* Service Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('vehicleDetail.serviceInfoTitle')}</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('vehicleDetail.odometerLabel')}</Text>
                {editingOdo ? (
                  <View style={styles.odoEditRow}>
                    <TextInput
                      style={styles.odoInput}
                      value={odoInput}
                      onChangeText={setOdoInput}
                      keyboardType="number-pad"
                      autoFocus
                      placeholder={t('vehicleDetail.kmPlaceholder')}
                      placeholderTextColor={COLORS.textMuted}
                    />
                    <TouchableOpacity style={styles.odoSaveBtn} onPress={saveOdometer} disabled={saving}>
                      {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.odoSaveBtnT}>{t('common.save')}</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.odoCancelBtn} onPress={() => setEditingOdo(false)}>
                      <CloseIcon size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={openOdoEditor} style={styles.odoTapRow}>
                    <Text style={styles.infoValue}>
                      {extVehicle.odometer ? `${extVehicle.odometer.toLocaleString()} km` : t('vehicleDetail.naLabel')}
                    </Text>
                    <Text style={styles.odoEditLabel}>{t('vehicleDetail.updateLabel')}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('vehicleDetail.lastServiceLabel')}</Text>
                <Text style={styles.infoValue}>{formatDate(extVehicle.last_service_date)}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('vehicleDetail.nextServiceLabel')}</Text>
                <Text style={[styles.infoValue, isOverdueOrSoon(extVehicle.next_service_date) && styles.infoValueWarn]}>
                  {formatDate(extVehicle.next_service_date)}
                  {isOverdueOrSoon(extVehicle.next_service_date) ? '  ⚠' : ''}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('vehicleDetail.insuranceExpiryLabel')}</Text>
                <Text style={[styles.infoValue, isOverdueOrSoon(extVehicle.insurance_expiry) && styles.infoValueWarn]}>
                  {formatDate(extVehicle.insurance_expiry)}
                  {isOverdueOrSoon(extVehicle.insurance_expiry) ? '  ⚠' : ''}
                </Text>
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
  infoValueWarn: {
    color: COLORS.danger,
    fontWeight: '700',
  },
  odoTapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  odoEditLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  odoEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  odoInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: COLORS.text,
  },
  odoSaveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 48,
    alignItems: 'center',
  },
  odoSaveBtnT: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  odoCancelBtn: {
    padding: 6,
  },
});
