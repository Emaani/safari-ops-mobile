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
import { Svg, Path, Rect, Line } from 'react-native-svg';
import type { Booking } from '../../types/dashboard';
import { formatCurrency } from '../../lib/utils';
import { getBookingStatusConfig } from '../../constants/bookingStatus';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary: '#1f4d45',
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

// Status colors sourced from unified constants — see src/constants/bookingStatus.ts

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

function CalendarIcon({ size = 24, color = COLORS.primary }: { size?: number; color?: string }) {
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

interface BookingDetailModalProps {
  booking: (Booking & { vehicle?: { name: string } }) | null;
  visible: boolean;
  onClose: () => void;
  /** Called when the user taps Edit — parent opens EditBookingModal */
  onEdit?: (booking: Booking) => void;
}

export function BookingDetailModal({ booking, visible, onClose, onEdit }: BookingDetailModalProps) {
  if (!booking) return null;

  const statusCfg    = getBookingStatusConfig(booking.status);
  const statusColors = statusCfg;
  const clientName = booking.client?.company_name || 'Unknown Client';
  const assignedUser = booking.profiles?.full_name || 'Unassigned';
  const startDate = new Date(booking.start_date).toLocaleDateString();
  const endDate = new Date(booking.end_date).toLocaleDateString();
  const amountPaid = booking.amount_paid || 0;
  const totalCost = booking.total_cost || 0;
  const balance = totalCost - amountPaid;
  const currency = booking.currency || 'USD';

  // Extended booking properties
  const extBooking = booking as any;

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
              <CalendarIcon size={24} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.headerTitle}>{booking.booking_number || `#${booking.id.slice(0, 8)}`}</Text>
              <Text style={styles.headerSubtitle}>{clientName}</Text>
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
                {booking.status}
              </Text>
            </View>
          </View>

          {/* Dates Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Dates</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Start Date</Text>
                <Text style={styles.infoValue}>{startDate}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>End Date</Text>
                <Text style={styles.infoValue}>{endDate}</Text>
              </View>
            </View>
          </View>

          {/* Client & Assignment Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assignment</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Client</Text>
                <Text style={styles.infoValue}>{clientName}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Assigned To</Text>
                <Text style={styles.infoValue}>{assignedUser}</Text>
              </View>
              {booking.vehicle && (
                <View style={[styles.infoItem, { width: '100%' }]}>
                  <Text style={styles.infoLabel}>Vehicle</Text>
                  <Text style={styles.infoValue}>{booking.vehicle.name}</Text>
                </View>
              )}
              {extBooking.destination && (
                <View style={[styles.infoItem, { width: '100%' }]}>
                  <Text style={styles.infoLabel}>Destination</Text>
                  <Text style={styles.infoValue}>{extBooking.destination}</Text>
                </View>
              )}
              {extBooking.pax_count && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Passengers</Text>
                  <Text style={styles.infoValue}>{extBooking.pax_count}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Payment Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Information</Text>
            <View style={styles.paymentGrid}>
              <View style={[styles.paymentItem, { backgroundColor: '#f3e8ff' }]}>
                <Text style={styles.paymentLabel}>Total Cost</Text>
                <Text style={styles.paymentValue}>
                  {formatCurrency(totalCost, currency)}
                </Text>
              </View>
              <View style={[styles.paymentItem, { backgroundColor: '#dcfce7' }]}>
                <Text style={styles.paymentLabel}>Amount Paid</Text>
                <Text style={[styles.paymentValue, { color: COLORS.success }]}>
                  {formatCurrency(amountPaid, currency)}
                </Text>
              </View>
              <View style={[styles.paymentItem, { backgroundColor: balance > 0 ? '#fef3c7' : '#dcfce7' }]}>
                <Text style={styles.paymentLabel}>Balance</Text>
                <Text style={[styles.paymentValue, { color: balance > 0 ? COLORS.warning : COLORS.success }]}>
                  {formatCurrency(balance, currency)}
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <Text style={styles.progressLabel}>Payment Progress</Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min((amountPaid / totalCost) * 100, 100)}%` }
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {totalCost > 0 ? Math.round((amountPaid / totalCost) * 100) : 0}% paid
              </Text>
            </View>
          </View>

          {/* Notes Section */}
          {extBooking.notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.notesText}>{extBooking.notes}</Text>
            </View>
          )}

          {/* Edit / Lock action */}
          {statusCfg.editable ? (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => { onClose(); onEdit?.(booking); }}
              activeOpacity={0.85}
            >
              <Text style={styles.editBtnText}>Edit Booking</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.lockNotice}>
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.lockText}>
                This booking is <Text style={{ fontWeight: '700' }}>{booking.status}</Text> and cannot be edited to preserve operational records.
              </Text>
            </View>
          )}

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
  paymentGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  paymentItem: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: 'right',
  },
  notesText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 32,
  },
  editBtn: {
    backgroundColor: '#1f4d45',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  editBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  lockNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f5f0e8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e1d7c8',
  },
  lockIcon: { fontSize: 16 },
  lockText: {
    flex: 1,
    fontSize: 13,
    color: '#7f7565',
    lineHeight: 18,
  },
});
