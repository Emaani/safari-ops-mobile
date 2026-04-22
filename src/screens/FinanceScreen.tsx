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
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { FadeSlideIn } from '../components/ui';
import { Svg, Path, Circle } from 'react-native-svg';
import { useFinanceData } from '../hooks/useFinanceData';
import type { RevenueItem, ExpenseItem } from '../hooks/useFinanceData';
import { useFinanceRealtimeSync } from '../hooks/useFinanceRealtimeSync';
import { TransactionDetailModal } from '../components/finance';
import type { FinancialTransaction, CashRequisition, Currency } from '../types/dashboard';
import { formatCurrency } from '../lib/utils';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary:    '#1f4d45',
  success:    '#3d8f6a',
  warning:    '#b8883f',
  danger:     '#c96d4d',
  income:     '#3d8f6a',
  expense:    '#c96d4d',
  background: '#f6f2eb',
  card:       '#fffdf9',
  text:       '#181512',
  textMuted:  '#7f7565',
  border:     '#e1d7c8',
  revenueBg:  '#ddf0e8',
  expenseBg:  '#fdf0ec',
};

const CURRENCIES: { label: string; value: Currency }[] = [
  { label: 'USD ($)', value: 'USD' },
  { label: 'UGX',     value: 'UGX' },
  { label: 'KES',     value: 'KES' },
];

// ============================================================================
// ICON COMPONENTS
// ============================================================================

function SearchIcon({ size = 18, color = COLORS.textMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx="11" cy="11" r="8" />
      <Path d="M21 21l-4.35-4.35" />
    </Svg>
  );
}

function TrendUpIcon({ size = 14, color = COLORS.income }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5}>
      <Path d="M22 7l-8.5 8.5-5-5L2 17" />
      <Path d="M16 7h6v6" />
    </Svg>
  );
}

function TrendDownIcon({ size = 14, color = COLORS.expense }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5}>
      <Path d="M22 17l-8.5-8.5-5 5L2 7" />
      <Path d="M16 17h6v-6" />
    </Svg>
  );
}

// ============================================================================
// KPI CARDS
// ============================================================================

interface KPICardProps {
  title: string;
  value: string;
  isPositive?: boolean;
  icon: React.ReactNode;
  accent: string;
  bg: string;
}

function KPICard({ title, value, isPositive, icon, accent, bg, delay = 0 }: KPICardProps & { delay?: number }) {
  const opacity = useSharedValue(0);
  const scale   = useSharedValue(0.88);
  React.useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
    scale.value   = withDelay(delay, withSpring(1, { damping: 18, stiffness: 220 }));
  }, [delay]);
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={[styles.kpiCard, { backgroundColor: bg }, animStyle]}>
      <View style={[styles.kpiIconWrap, { backgroundColor: accent + '22' }]}>{icon}</View>
      <Text style={styles.kpiTitle}>{title}</Text>
      <Text style={[styles.kpiValue, { color: accent }]}>{value}</Text>
    </Animated.View>
  );
}

// ============================================================================
// REVENUE ROW
// ============================================================================

const SOURCE_LABELS: Record<string, string> = {
  booking:        'Reservation',
  safari_booking: 'Safari',
  transaction:    'Income',
};

function RevenueRow({
  item,
  displayCurrency,
  onPress,
}: {
  item: RevenueItem;
  displayCurrency: Currency;
  onPress: (item: RevenueItem) => void;
}) {
  const rates: Record<string, number> = { USD: 1, UGX: 3700, KES: 130 };
  const displayed = (item.amount / (rates[item.currency] || 1)) * (rates[displayCurrency] || 1);
  const date = item.date ? new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const sourceLabel = SOURCE_LABELS[item.source] || item.source;
  const statusColor = item.status?.toLowerCase() === 'completed' || item.status?.toLowerCase() === 'confirmed'
    ? COLORS.success : COLORS.warning;

  return (
    <TouchableOpacity style={styles.rowCard} onPress={() => onPress(item)} activeOpacity={0.75}>
      <View style={[styles.rowIconWrap, { backgroundColor: '#dcfce7' }]}>
        <TrendUpIcon size={16} color={COLORS.income} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>{item.subtitle || date}</Text>
        <View style={styles.rowMeta}>
          <View style={[styles.sourceBadge, { backgroundColor: '#dbeafe' }]}>
            <Text style={[styles.sourceBadgeText, { color: '#1d4ed8' }]}>{sourceLabel}</Text>
          </View>
          <View style={[styles.sourceBadge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.sourceBadgeText, { color: statusColor }]}>{item.status}</Text>
          </View>
          <Text style={styles.rowDate}>{date}</Text>
        </View>
      </View>
      <Text style={[styles.rowAmount, { color: COLORS.income }]}>
        +{formatCurrency(displayed, displayCurrency)}
      </Text>
    </TouchableOpacity>
  );
}

// ============================================================================
// EXPENSE ROW
// ============================================================================

function ExpenseRow({
  item,
  displayCurrency,
  onPress,
}: {
  item: ExpenseItem;
  displayCurrency: Currency;
  onPress: (item: ExpenseItem) => void;
}) {
  const rates: Record<string, number> = { USD: 1, UGX: 3700, KES: 130 };
  const displayed = (item.amount / (rates[item.currency] || 1)) * (rates[displayCurrency] || 1);
  const date = item.date ? new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const sourceLabel = item.source === 'cash_requisition' ? 'Cash Req.' : 'Expense';
  const statusColor = item.status?.toLowerCase() === 'completed' || item.status?.toLowerCase() === 'resolved'
    ? COLORS.success : item.status?.toLowerCase() === 'approved' ? COLORS.warning : COLORS.textMuted;

  return (
    <TouchableOpacity style={styles.rowCard} onPress={() => onPress(item)} activeOpacity={0.75}>
      <View style={[styles.rowIconWrap, { backgroundColor: '#fee2e2' }]}>
        <TrendDownIcon size={16} color={COLORS.expense} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>{item.subtitle || date}</Text>
        <View style={styles.rowMeta}>
          <View style={[styles.sourceBadge, { backgroundColor: '#fef3c7' }]}>
            <Text style={[styles.sourceBadgeText, { color: '#92400e' }]}>{sourceLabel}</Text>
          </View>
          <View style={[styles.sourceBadge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.sourceBadgeText, { color: statusColor }]}>{item.status}</Text>
          </View>
          <Text style={styles.rowDate}>{date}</Text>
        </View>
      </View>
      <Text style={[styles.rowAmount, { color: COLORS.expense }]}>
        -{formatCurrency(displayed, displayCurrency)}
      </Text>
    </TouchableOpacity>
  );
}

// ============================================================================
// LOADING / ERROR
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

function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
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
// MAIN FINANCE SCREEN
// ============================================================================

export function FinanceScreen() {
  const [currency,   setCurrency]   = useState<Currency>('USD');
  const [activeTab,  setActiveTab]  = useState<'revenue' | 'expenses'>('revenue');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // For detail modal — adapted to work with both item types
  const [modalItem,    setModalItem]    = useState<FinancialTransaction | CashRequisition | null>(null);
  const [modalType,    setModalType]    = useState<'transaction' | 'cr'>('transaction');
  const [modalVisible, setModalVisible] = useState(false);

  const {
    revenueItems,
    expenseItems,
    revenueMTD,
    expensesMTD,
    netProfitMTD,
    pendingCRCount,
    loading,
    error,
    refetch,
  } = useFinanceData({ currency });

  useFinanceRealtimeSync(refetch);

  // ── Filtered lists ────────────────────────────────────────────────────────

  const filteredRevenue = useMemo(() => {
    if (!searchQuery.trim()) return revenueItems;
    const q = searchQuery.toLowerCase();
    return revenueItems.filter(
      i => i.title.toLowerCase().includes(q) ||
           i.subtitle.toLowerCase().includes(q) ||
           (i.reference || '').toLowerCase().includes(q)
    );
  }, [revenueItems, searchQuery]);

  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return expenseItems;
    const q = searchQuery.toLowerCase();
    return expenseItems.filter(
      i => i.title.toLowerCase().includes(q) ||
           i.subtitle.toLowerCase().includes(q) ||
           (i.reference || '').toLowerCase().includes(q)
    );
  }, [expenseItems, searchQuery]);

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleRevenuePress = useCallback((item: RevenueItem) => {
    // Map to FinancialTransaction shape for the existing modal
    const mapped: FinancialTransaction = {
      id:               item.id,
      transaction_date: item.date,
      amount:           item.amount,
      transaction_type: 'income',
      category:         item.title,
      currency:         item.currency,
      description:      item.subtitle,
      reference_number: item.reference,
      status:           item.status,
    };
    setModalItem(mapped);
    setModalType('transaction');
    setModalVisible(true);
  }, []);

  const handleExpensePress = useCallback((item: ExpenseItem) => {
    if (item.source === 'cash_requisition') {
      // Map to CashRequisition shape
      const mapped: CashRequisition = {
        id:               item.id.replace('cr-', ''),
        cr_number:        item.reference || item.id,
        total_cost:       item.amount,
        currency:         item.currency,
        status:           item.status as CashRequisition['status'],
        date_needed:      item.date,
        expense_category: item.title,
        created_at:       item.date,
        description:      item.subtitle,
      };
      setModalItem(mapped);
      setModalType('cr');
    } else {
      const mapped: FinancialTransaction = {
        id:               item.id,
        transaction_date: item.date,
        amount:           item.amount,
        transaction_type: 'expense',
        category:         item.title,
        currency:         item.currency,
        description:      item.subtitle,
        reference_number: item.reference,
        status:           item.status,
      };
      setModalItem(mapped);
      setModalType('transaction');
    }
    setModalVisible(true);
  }, []);

  // ── Error state ───────────────────────────────────────────────────────────

  if (error && !loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Finance</Text>
        </View>
        <ErrorMessage message={error.message || 'Failed to load financial data'} onRetry={refetch} />
      </SafeAreaView>
    );
  }

  // ── Header / List ─────────────────────────────────────────────────────────

  const renderHeader = () => (
    <>
      {/* Currency chips */}
      <View style={styles.currencyRow}>
        <Text style={styles.sectionLabel}>Display Currency</Text>
        <View style={styles.currencyChips}>
          {CURRENCIES.map(c => (
            <TouchableOpacity
              key={c.value}
              style={[styles.currencyChip, currency === c.value && styles.currencyChipActive]}
              onPress={() => setCurrency(c.value)}
            >
              <Text style={[styles.currencyChipText, currency === c.value && styles.currencyChipTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        <KPICard delay={0}   title="Revenue (MTD)"  value={formatCurrency(revenueMTD,  currency)} accent={COLORS.income}  bg={COLORS.revenueBg} icon={<TrendUpIcon   size={15} color={COLORS.income}  />} />
        <KPICard delay={70}  title="Expenses (MTD)" value={formatCurrency(expensesMTD, currency)} accent={COLORS.expense} bg={COLORS.expenseBg} icon={<TrendDownIcon size={15} color={COLORS.expense} />} />
        <KPICard delay={140} title="Net Profit"      value={formatCurrency(netProfitMTD, currency)} accent={netProfitMTD >= 0 ? COLORS.income : COLORS.expense} bg={netProfitMTD >= 0 ? COLORS.revenueBg : '#f5e8ce'} icon={<TrendUpIcon size={15} color={netProfitMTD >= 0 ? COLORS.income : COLORS.expense} />} />
      </View>

      {/* Tab selector now lives in the hero header above the list */}

      {/* Search */}
      <View style={styles.searchRow}>
        <SearchIcon size={17} />
        <TextInput
          style={styles.searchInput}
          placeholder={activeTab === 'revenue' ? 'Search revenue...' : 'Search expenses...'}
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Section count */}
      <Text style={styles.listCount}>
        {activeTab === 'revenue'
          ? `${filteredRevenue.length} revenue record${filteredRevenue.length !== 1 ? 's' : ''}`
          : `${filteredExpenses.length} expense record${filteredExpenses.length !== 1 ? 's' : ''}`}
      </Text>
    </>
  );

  const renderRevenueItem = ({ item, index }: { item: RevenueItem; index: number }) => (
    <FadeSlideIn delay={Math.min(index * 40, 300)} distance={14}>
      <RevenueRow item={item} displayCurrency={currency} onPress={handleRevenuePress} />
    </FadeSlideIn>
  );

  const renderExpenseItem = ({ item, index }: { item: ExpenseItem; index: number }) => (
    <FadeSlideIn delay={Math.min(index * 40, 300)} distance={14}>
      <ExpenseRow item={item} displayCurrency={currency} onPress={handleExpensePress} />
    </FadeSlideIn>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>
        {activeTab === 'revenue' ? 'No revenue records found' : 'No expense records found'}
      </Text>
      <Text style={styles.emptyMessage}>
        {searchQuery ? 'Try adjusting your search' : 'Records will appear here once available'}
      </Text>
    </View>
  );

  const listData  = activeTab === 'revenue' ? filteredRevenue : filteredExpenses;
  const renderRow = activeTab === 'revenue' ? renderRevenueItem : renderExpenseItem as any;

  return (
    <SafeAreaView style={styles.safeArea}>
      {loading && !refreshing && <LoadingOverlay />}

      <FadeSlideIn delay={0} distance={-10}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>Operations</Text>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroTitle}>Finance</Text>
              <Text style={styles.heroSub}>Revenue &amp; Expenses</Text>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: netProfitMTD >= 0 ? '#3d8f6a' : '#c96d4d' }]}>
              <Text style={styles.heroBadgeText}>{netProfitMTD >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(netProfitMTD), currency)}</Text>
            </View>
          </View>
          {/* Tab selector on dark bg */}
          <View style={styles.heroTabs}>
            {(['revenue', 'expenses'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.heroTab, activeTab === tab && styles.heroTabActive]}
                onPress={() => { setActiveTab(tab); setSearchQuery(''); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.heroTabText, activeTab === tab && styles.heroTabTextActive]}>
                  {tab === 'revenue' ? `Revenue (${revenueItems.length})` : `Expenses (${expenseItems.length})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </FadeSlideIn>

      <FlatList
        data={listData}
        keyExtractor={(item: any) => item.id}
        renderItem={renderRow}
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

      <TransactionDetailModal
        item={modalItem}
        itemType={modalType}
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setModalItem(null); }}
        displayCurrency={currency}
        onRefetch={refetch}
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
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  hero: { backgroundColor: '#171513', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, gap: 12 },
  heroEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: '#b8ab95' },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  heroTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -1, color: '#fffaf3' },
  heroSub: { fontSize: 13, color: '#b8ab95', marginTop: 2 },
  heroBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  heroBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  heroTabs: { flexDirection: 'row', gap: 8 },
  heroTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroTabActive: { backgroundColor: '#fffdf9' },
  heroTabText: { fontSize: 13, fontWeight: '700', color: '#b8ab95' },
  heroTabTextActive: { color: '#181512', fontWeight: '800' },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // Currency
  currencyRow: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  currencyChips: {
    flexDirection: 'row',
    gap: 8,
  },
  currencyChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  currencyChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  currencyChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  currencyChipTextActive: {
    color: '#fff',
  },

  // KPI
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: 'flex-start',
  },
  kpiIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActiveRevenue: {
    backgroundColor: '#059669',
  },
  tabActiveExpense: {
    backgroundColor: '#dc2626',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabTextActiveRevenue: {
    color: '#ffffff',
  },
  tabTextActiveExpense: {
    color: '#ffffff',
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  listCount: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 10,
    fontWeight: '500',
  },

  // Row cards
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  rowSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  sourceBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  rowDate: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  rowAmount: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginLeft: 8,
  },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(241,245,249,0.9)',
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
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textMuted,
  },

  // Error
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
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
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});

export default FinanceScreen;
