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

function CloseIcon({ size = 24, color = COLORS.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}

function CompassIcon({ size = 24, color = COLORS.safari }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
    </Svg>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

interface SafariDetailModalProps {
  safari: (Booking & { vehicle?: { name: string }; destination?: string; pax_count?: number }) | null;
  visible: boolean;
  onClose: () => void;
}

export function SafariDetailModal({ safari, visible, onClose }: SafariDetailModalProps) {
  if (!safari) return null;

  const statusColors = STATUS_COLORS[safari.status] || STATUS_COLORS.Confirmed;
  const clientName = safari.client?.company_name || 'Unknown Client';
  const assignedUser = safari.profiles?.full_name || 'Unassigned';
  const startDate = new Date(safari.start_date).toLocaleDateString();
  const endDate = new Date(safari.end_date).toLocaleDateString();
  const amountPaid = safari.amount_paid || 0;
  const totalCost = safari.total_cost || 0;
  const balance = totalCost - amountPaid;
  const currency = safari.currency || 'USD';

  // Calculate duration
  const start = new Date(safari.start_date);
  const end = new Date(safari.end_date);
  const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const extSafari = safari as any;

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
              <CompassIcon size={24} color={COLORS.safari} />
            </View>
            <View>
              <Text style={styles.headerTitle}>{safari.booking_number || `#${safari.id.slice(0, 8)}`}</Text>
              <Text style={styles.headerSubtitle}>Safari Trip</Text>
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
                {safari.status}
              </Text>
            </View>
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{durationDays} Days</Text>
            </View>
          </View>

          {/* Trip Overview */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trip Overview</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Start Date</Text>
                <Text style={styles.infoValue}>{startDate}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>End Date</Text>
                <Text style={styles.infoValue}>{endDate}</Text>
              </View>
              {extSafari.destination && (
                <View style={[styles.infoItem, { width: '100%' }]}>
                  <Text style={styles.infoLabel}>Destination</Text>
                  <Text style={styles.infoValue}>{extSafari.destination}</Text>
                </View>
              )}
              {extSafari.pax_count && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Passengers</Text>
                  <Text style={styles.infoValue}>{extSafari.pax_count} pax</Text>
                </View>
              )}
            </View>
          </View>

          {/* Client & Assignment */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assignment</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Client</Text>
                <Text style={styles.infoValue}>{clientName}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Driver/Guide</Text>
                <Text style={styles.infoValue}>{assignedUser}</Text>
              </View>
              {safari.vehicle && (
                <View style={[styles.infoItem, { width: '100%' }]}>
                  <Text style={styles.infoLabel}>Vehicle</Text>
                  <Text style={styles.infoValue}>{safari.vehicle.name}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Payment Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Information</Text>
            <View style={styles.paymentGrid}>
              <View style={[styles.paymentItem, { backgroundColor: '#d1fae5' }]}>
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
          </View>

          {/* Notes */}
          {extSafari.notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.notesText}>{extSafari.notes}</Text>
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
    backgroundColor: '#d1fae5',
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
    gap: 12,
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
  durationBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#d1fae5',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.safari,
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
  notesText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 32,
  },
});
