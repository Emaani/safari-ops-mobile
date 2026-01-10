import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Svg, Path, Circle } from 'react-native-svg';
import { useFinanceData } from '../hooks/useFinanceData';
import { useFinanceRealtimeSync } from '../hooks/useFinanceRealtimeSync';
import { TransactionCard, CRCard, TransactionDetailModal } from '../components/finance';
import type { FinancialTransaction, CashRequisition, Currency } from '../types/dashboard';
import { formatCurrency } from '../lib/utils';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#9333ea',
  income: '#059669',
  expense: '#dc2626',
  background: '#f3f4f6',
  card: '#ffffff',
  text: '#111827',
  textMuted: '#6b7280',
  border: '#e5e7eb',
};

const CURRENCIES: { label: string; value: Currency }[] = [
  { label: 'USD ($)', value: 'USD' },
  { label: 'UGX', value: 'UGX' },
  { label: 'KES', value: 'KES' },
];

// ============================================================================
// ICON COMPONENTS
// ============================================================================

function SearchIcon({ size = 20, color = COLORS.textMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx="11" cy="11" r="8" />
      <Path d="M21 21l-4.35-4.35" />
    </Svg>
  );
}

function DollarIcon({ size = 20, color = COLORS.success }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M12 2v20" />
      <Path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Svg>
  );
}

// ============================================================================
// KPI CARD COMPONENT
// ============================================================================

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  color: string;
  bgColor: string;
}

function KPICard({ title, value, subtitle, color, bgColor }: KPICardProps) {
  return (
    <View style={[styles.kpiCard, { backgroundColor: bgColor }]}>
      <Text style={styles.kpiTitle}>{title}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.kpiSubtitle}>{subtitle}</Text>}
    </View>
  );
}

// ============================================================================
// LOADING OVERLAY COMPONENT
// ============================================================================

function LoadingOverlay() {
  return (
    <View style={styles.loadingOverlay}>
      <View style={styles.loadingCard}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading finances...</Text>
      </View>
    </View>
  );
}

// ============================================================================
// ERROR MESSAGE COMPONENT
// ============================================================================

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Tap to retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ============================================================================
// TAB SELECTOR COMPONENT
// ============================================================================

interface TabSelectorProps {
  tabs: { key: string; label: string }[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

function TabSelector({ tabs, activeTab, onTabChange }: TabSelectorProps) {
  return (
    <View style={styles.tabContainer}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tab,
            activeTab === tab.key && styles.tabActive,
          ]}
          onPress={() => onTabChange(tab.key)}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === tab.key && styles.tabTextActive,
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ============================================================================
// MAIN FINANCE SCREEN
// ============================================================================

export function FinanceScreen() {
  console.log('[FinanceScreen] Component mounted');

  // ========================================================================
  // STATE
  // ========================================================================

  const [currency, setCurrency] = useState<Currency>('USD');
  const [activeTab, setActiveTab] = useState<'transactions' | 'requisitions'>('transactions');
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FinancialTransaction | CashRequisition | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<'transaction' | 'cr'>('transaction');
  const [modalVisible, setModalVisible] = useState(false);

  // ========================================================================
  // HOOKS
  // ========================================================================

  const {
    transactions,
    cashRequisitions,
    revenueMTD,
    expensesMTD,
    netProfitMTD,
    pendingCRCount,
    loading,
    error,
    refetch,
  } = useFinanceData({ currency });

  // Real-time sync
  useFinanceRealtimeSync(refetch);

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  const filteredTransactions = useMemo(() => {
    let result = transactions;

    // Apply type filter
    if (transactionFilter !== 'all') {
      result = result.filter((t) => t.transaction_type === transactionFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          (t.category || '').toLowerCase().includes(query) ||
          (t.description || '').toLowerCase().includes(query)
      );
    }

    console.log(`[FinanceScreen] Filtered ${result.length} transactions from ${transactions.length}`);

    return result;
  }, [transactions, transactionFilter, searchQuery]);

  const filteredCRs = useMemo(() => {
    let result = cashRequisitions;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (cr) =>
          (cr.cr_number || '').toLowerCase().includes(query) ||
          (cr.expense_category || '').toLowerCase().includes(query)
      );
    }

    console.log(`[FinanceScreen] Filtered ${result.length} CRs from ${cashRequisitions.length}`);

    return result;
  }, [cashRequisitions, searchQuery]);

  const tabs = [
    { key: 'transactions', label: 'Transactions' },
    { key: 'requisitions', label: `CRs (${pendingCRCount})` },
  ];

  // ========================================================================
  // CALLBACKS
  // ========================================================================

  const handleRefresh = useCallback(async () => {
    console.log('[FinanceScreen] Pull-to-refresh triggered');
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleTransactionPress = useCallback((transaction: FinancialTransaction) => {
    console.log('[FinanceScreen] Transaction pressed:', transaction.id);
    setSelectedItem(transaction);
    setSelectedItemType('transaction');
    setModalVisible(true);
  }, []);

  const handleCRPress = useCallback((cr: CashRequisition) => {
    console.log('[FinanceScreen] CR pressed:', cr.cr_number);
    setSelectedItem(cr);
    setSelectedItemType('cr');
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedItem(null);
  }, []);

  // ========================================================================
  // RENDER
  // ========================================================================

  // Show error if data fetch failed
  if (error && !loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Finance</Text>
        </View>
        <ErrorMessage
          message={error.message || 'Failed to load financial data'}
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <>
      {/* Currency Picker */}
      <View style={styles.currencyContainer}>
        <Text style={styles.currencyLabel}>Currency</Text>
        <View style={styles.currencyPickerWrapper}>
          <Picker
            selectedValue={currency}
            onValueChange={(value) => setCurrency(value)}
            style={styles.currencyPicker}
          >
            {CURRENCIES.map((curr) => (
              <Picker.Item key={curr.value} label={curr.label} value={curr.value} />
            ))}
          </Picker>
        </View>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        <KPICard
          title="Revenue (MTD)"
          value={formatCurrency(revenueMTD, currency)}
          color={COLORS.success}
          bgColor="#d1fae5"
        />
        <KPICard
          title="Expenses (MTD)"
          value={formatCurrency(expensesMTD, currency)}
          color={COLORS.danger}
          bgColor="#fee2e2"
        />
        <KPICard
          title="Net Profit (MTD)"
          value={formatCurrency(netProfitMTD, currency)}
          color={netProfitMTD >= 0 ? COLORS.success : COLORS.danger}
          bgColor={netProfitMTD >= 0 ? '#dcfce7' : '#fef3c7'}
        />
      </View>

      {/* Tab Selector */}
      <TabSelector
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab as any);
          setSearchQuery('');
        }}
      />

      {/* Search and Filter Row */}
      <View style={styles.searchFilterRow}>
        <View style={styles.searchInputContainer}>
          <SearchIcon size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={activeTab === 'transactions' ? 'Search transactions...' : 'Search CRs...'}
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        {activeTab === 'transactions' && (
          <View style={styles.filterPillsRow}>
            {(['all', 'income', 'expense'] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterPill,
                  transactionFilter === filter && styles.filterPillActive,
                ]}
                onPress={() => setTransactionFilter(filter)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    transactionFilter === filter && styles.filterPillTextActive,
                  ]}
                >
                  {filter === 'all' ? 'All' : filter === 'income' ? 'Income' : 'Expense'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* List Header */}
      <Text style={styles.listHeader}>
        {activeTab === 'transactions'
          ? `Transactions (${filteredTransactions.length})`
          : `Cash Requisitions (${filteredCRs.length})`
        }
      </Text>
    </>
  );

  const renderTransaction = ({ item }: { item: FinancialTransaction }) => (
    <TransactionCard
      transaction={item}
      onPress={handleTransactionPress}
      displayCurrency={currency}
    />
  );

  const renderCR = ({ item }: { item: CashRequisition }) => (
    <CRCard
      cr={item}
      onPress={handleCRPress}
      displayCurrency={currency}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <DollarIcon size={48} color={COLORS.textMuted} />
      <Text style={styles.emptyTitle}>
        {activeTab === 'transactions' ? 'No transactions found' : 'No cash requisitions found'}
      </Text>
      <Text style={styles.emptyMessage}>
        {searchQuery
          ? 'Try adjusting your search'
          : activeTab === 'transactions'
            ? 'Transactions will appear here'
            : 'Cash requisitions will appear here'
        }
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Loading Overlay */}
      {loading && !refreshing && <LoadingOverlay />}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Finance</Text>
      </View>

      {/* Main Content */}
      <FlatList
        data={activeTab === 'transactions' ? filteredTransactions : filteredCRs}
        keyExtractor={(item: any) => item.id}
        renderItem={activeTab === 'transactions' ? renderTransaction : renderCR as any}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!loading ? renderEmpty : null}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      />

      {/* Detail Modal */}
      <TransactionDetailModal
        item={selectedItem}
        itemType={selectedItemType}
        visible={modalVisible}
        onClose={handleCloseModal}
        displayCurrency={currency}
      />
    </SafeAreaView>
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
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  currencyContainer: {
    marginBottom: 16,
  },
  currencyLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  currencyPickerWrapper: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  currencyPicker: {
    height: 44,
    color: COLORS.text,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
  },
  kpiTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  kpiSubtitle: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  searchFilterRow: {
    marginBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: COLORS.text,
    marginLeft: 8,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  listHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
    marginTop: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(243, 244, 246, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});

export default FinanceScreen;
