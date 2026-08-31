import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Svg, Path, Circle, Rect } from 'react-native-svg';
import type { FinancialTransaction } from '../../types/dashboard';
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
  income:     '#34A853',
  expense:    '#FF3B30',
  background: '#F2F2F7',
  card:       '#FFFFFF',
  text:       '#1C1C1E',
  textMuted:  '#6C6C70',
  border:     '#E5E5EA',
};

// ============================================================================
// ICON COMPONENTS
// ============================================================================

function ArrowUpIcon({ size = 16, color = COLORS.income }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M12 19V5" />
      <Path d="M5 12l7-7 7 7" />
    </Svg>
  );
}

function ArrowDownIcon({ size = 16, color = COLORS.expense }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M12 5v14" />
      <Path d="M19 12l-7 7-7-7" />
    </Svg>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

interface TransactionCardProps {
  transaction: FinancialTransaction;
  onPress: (transaction: FinancialTransaction) => void;
  displayCurrency?: 'USD' | 'UGX' | 'KES';
}

export function TransactionCard({ transaction, onPress, displayCurrency = 'USD' }: TransactionCardProps) {
  const isIncome = transaction.transaction_type === 'income';
  const date = new Date(transaction.transaction_date).toLocaleDateString();
  const statusColor = transaction.status === 'completed' ? COLORS.success :
                      transaction.status === 'pending' ? COLORS.warning : COLORS.textMuted;

  // Simple currency conversion
  const convertAmount = (amount: number, fromCurrency: string): number => {
    const rates: Record<string, number> = { USD: 1, UGX: 3700, KES: 130 };
    const fromRate = rates[fromCurrency] || 1;
    const toRate = rates[displayCurrency] || 1;
    return (amount / fromRate) * toRate;
  };

  const displayAmount = convertAmount(transaction.amount, transaction.currency || 'USD');

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(transaction)}
      activeOpacity={0.7}
    >
      <View style={styles.leftSection}>
        <View style={[
          styles.iconContainer,
          { backgroundColor: isIncome ? '#D8F0E4' : '#fdf0ec' }
        ]}>
          {isIncome ? (
            <ArrowUpIcon size={18} color={COLORS.income} />
          ) : (
            <ArrowDownIcon size={18} color={COLORS.expense} />
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.category} numberOfLines={1}>
            {transaction.category || 'Uncategorized'}
          </Text>
          <Text style={styles.description} numberOfLines={1}>
            {transaction.description || 'No description'}
          </Text>
          <Text style={styles.date}>{date}</Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        <Text style={[
          styles.amount,
          { color: isIncome ? COLORS.income : COLORS.expense }
        ]}>
          {isIncome ? '+' : '-'}{formatCurrency(displayAmount, displayCurrency)}
        </Text>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  category: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  description: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  date: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
});
