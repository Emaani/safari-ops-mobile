import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Svg, Path, Rect } from 'react-native-svg';
import type { CashRequisition } from '../../types/dashboard';
import { formatCurrency } from '../../lib/utils';

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
  Pending:   { bg: '#FEF3DC', text: '#7a5000' },
  Approved:  { bg: '#FEF0DC', text: '#8B6B3E' },
  Completed: { bg: '#E8F7EE', text: '#1A6B3C' },
  Resolved:  { bg: '#EDE8FE', text: '#5436CC' },
  Rejected:  { bg: '#FFEEED', text: '#CC1400' },
  Declined:  { bg: '#FFEEED', text: '#CC1400' },
  Cancelled: { bg: '#F2F2F7', text: '#6C6C70' },
};

// ============================================================================
// ICON COMPONENT
// ============================================================================

function FileTextIcon({ size = 18, color = COLORS.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
      <Path d="M16 13H8" />
      <Path d="M16 17H8" />
      <Path d="M10 9H8" />
    </Svg>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

interface CRCardProps {
  cr: CashRequisition & { description?: string; requested_by?: string };
  onPress: (cr: CashRequisition) => void;
  displayCurrency?: 'USD' | 'UGX' | 'KES';
}

export function CRCard({ cr, onPress, displayCurrency = 'USD' }: CRCardProps) {
  const statusColors = STATUS_COLORS[cr.status] || STATUS_COLORS.Pending;
  const date = new Date(cr.created_at).toLocaleDateString();
  const dateNeeded = cr.date_needed ? new Date(cr.date_needed).toLocaleDateString() : 'N/A';

  // Simple currency conversion
  const convertAmount = (amount: number, fromCurrency: string): number => {
    const rates: Record<string, number> = { USD: 1, UGX: 3700, KES: 130 };
    const fromRate = rates[fromCurrency] || 1;
    const toRate = rates[displayCurrency] || 1;
    return (amount / fromRate) * toRate;
  };

  const displayAmount = convertAmount(
    cr.amount_usd || cr.total_cost,
    cr.amount_usd ? 'USD' : (cr.currency || 'USD')
  );

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(cr)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <FileTextIcon size={18} color={COLORS.primary} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.crNumber}>{cr.cr_number}</Text>
          <Text style={styles.category} numberOfLines={1}>
            {cr.expense_category || 'Uncategorized'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusText, { color: statusColors.text }]}>
            {cr.status}
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Amount</Text>
            <Text style={styles.detailValue}>
              {formatCurrency(displayAmount, displayCurrency)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Date Needed</Text>
            <Text style={styles.detailValue}>{dateNeeded}</Text>
          </View>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>Created: {date}</Text>
        </View>
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
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerInfo: {
    flex: 1,
  },
  crNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  category: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
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
    paddingTop: 10,
  },
  detailRow: {
    flexDirection: 'row',
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  footer: {
    marginTop: 8,
  },
  footerText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
});
