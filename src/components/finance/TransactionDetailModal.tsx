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
import { Svg, Path, Line } from 'react-native-svg';
import type { FinancialTransaction, CashRequisition } from '../../types/dashboard';
import { formatCurrency } from '../../lib/utils';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  income: '#059669',
  expense: '#dc2626',
  background: '#f3f4f6',
  card: '#ffffff',
  text: '#111827',
  textMuted: '#6b7280',
  border: '#e5e7eb',
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

function DollarIcon({ size = 24, color = COLORS.success }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M12 2v20" />
      <Path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Svg>
  );
}

// ============================================================================
// TYPES
// ============================================================================

type DetailItem = FinancialTransaction | (CashRequisition & { description?: string });

// ============================================================================
// COMPONENT
// ============================================================================

interface TransactionDetailModalProps {
  item: DetailItem | null;
  itemType: 'transaction' | 'cr';
  visible: boolean;
  onClose: () => void;
  displayCurrency?: 'USD' | 'UGX' | 'KES';
}

export function TransactionDetailModal({
  item,
  itemType,
  visible,
  onClose,
  displayCurrency = 'USD',
}: TransactionDetailModalProps) {
  if (!item) return null;

  // Simple currency conversion
  const convertAmount = (amount: number, fromCurrency: string): number => {
    const rates: Record<string, number> = { USD: 1, UGX: 3700, KES: 130 };
    const fromRate = rates[fromCurrency] || 1;
    const toRate = rates[displayCurrency] || 1;
    return (amount / fromRate) * toRate;
  };

  if (itemType === 'transaction') {
    const transaction = item as FinancialTransaction;
    const isIncome = transaction.transaction_type === 'income';
    const displayAmount = convertAmount(transaction.amount, transaction.currency || 'USD');
    const date = new Date(transaction.transaction_date).toLocaleDateString();

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
              <View style={[
                styles.iconContainer,
                { backgroundColor: isIncome ? '#d1fae5' : '#fee2e2' }
              ]}>
                <DollarIcon size={24} color={isIncome ? COLORS.income : COLORS.expense} />
              </View>
              <View>
                <Text style={styles.headerTitle}>
                  {isIncome ? 'Income' : 'Expense'}
                </Text>
                <Text style={styles.headerSubtitle}>{date}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <CloseIcon size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Amount Section */}
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Amount</Text>
              <Text style={[
                styles.amountValue,
                { color: isIncome ? COLORS.income : COLORS.expense }
              ]}>
                {isIncome ? '+' : '-'}{formatCurrency(displayAmount, displayCurrency)}
              </Text>
            </View>

            {/* Details Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Transaction Details</Text>
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Category</Text>
                  <Text style={styles.infoValue}>
                    {transaction.category || 'Uncategorized'}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Status</Text>
                  <Text style={styles.infoValue}>{transaction.status || 'N/A'}</Text>
                </View>
                {transaction.reference_number && (
                  <View style={[styles.infoItem, { width: '100%' }]}>
                    <Text style={styles.infoLabel}>Reference</Text>
                    <Text style={styles.infoValue}>{transaction.reference_number}</Text>
                  </View>
                )}
                <View style={[styles.infoItem, { width: '100%' }]}>
                  <Text style={styles.infoLabel}>Original Currency</Text>
                  <Text style={styles.infoValue}>
                    {formatCurrency(transaction.amount, transaction.currency || 'USD')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Description Section */}
            {transaction.description && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.descriptionText}>{transaction.description}</Text>
              </View>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  // CR Detail
  const cr = item as CashRequisition & { description?: string };
  const displayAmount = convertAmount(
    cr.amount_usd || cr.total_cost,
    cr.amount_usd ? 'USD' : (cr.currency || 'USD')
  );
  const createdDate = new Date(cr.created_at).toLocaleDateString();
  const dateNeeded = cr.date_needed ? new Date(cr.date_needed).toLocaleDateString() : 'N/A';

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
              <DollarIcon size={24} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.headerTitle}>{cr.cr_number}</Text>
              <Text style={styles.headerSubtitle}>Cash Requisition</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <CloseIcon size={24} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Amount Section */}
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Requested Amount</Text>
            <Text style={styles.amountValue}>
              {formatCurrency(displayAmount, displayCurrency)}
            </Text>
          </View>

          {/* Status Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={[styles.statusBadge, { alignSelf: 'flex-start' }]}>
              <Text style={styles.statusText}>{cr.status}</Text>
            </View>
          </View>

          {/* Details Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Category</Text>
                <Text style={styles.infoValue}>
                  {cr.expense_category || 'Uncategorized'}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Date Needed</Text>
                <Text style={styles.infoValue}>{dateNeeded}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Created</Text>
                <Text style={styles.infoValue}>{createdDate}</Text>
              </View>
              {cr.date_completed && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Completed</Text>
                  <Text style={styles.infoValue}>
                    {new Date(cr.date_completed).toLocaleDateString()}
                  </Text>
                </View>
              )}
              <View style={[styles.infoItem, { width: '100%' }]}>
                <Text style={styles.infoLabel}>Original Amount</Text>
                <Text style={styles.infoValue}>
                  {formatCurrency(cr.total_cost, cr.currency || 'USD')}
                </Text>
              </View>
            </View>
          </View>

          {/* Description Section */}
          {cr.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.descriptionText}>{cr.description}</Text>
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
  amountSection: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 20,
    marginVertical: 16,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.text,
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
  statusBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
  },
  descriptionText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 32,
  },
});
