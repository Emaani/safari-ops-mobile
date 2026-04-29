import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
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
import { Svg, Path, Circle, Rect } from 'react-native-svg';
import { useFinanceData } from '../hooks/useFinanceData';
import type { RevenueItem, ExpenseItem } from '../hooks/useFinanceData';
import { useFinanceRealtimeSync } from '../hooks/useFinanceRealtimeSync';
import { TransactionDetailModal } from '../components/finance';
import { AddExpenseModal } from '../components/forms';
import { LoadingOverlay } from '../components/system/JackalLoader';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { FinancialTransaction, CashRequisition, CRStatus, Currency } from '../types/dashboard';
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

const CR_STATUS_FILTERS: { label: string; value: 'all' | CRStatus }[] = [
  { label: 'All',       value: 'all' },
  { label: 'Pending',   value: 'Pending' },
  { label: 'Approved',  value: 'Approved' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Resolved',  value: 'Resolved' },
  { label: 'Declined',  value: 'Declined' },
  { label: 'Rejected',  value: 'Rejected' },
  { label: 'Cancelled', value: 'Cancelled' },
];

function crStatusColor(status: string): string {
  switch (status) {
    case 'Pending':             return COLORS.warning;
    case 'Approved':            return '#1d4ed8';
    case 'Completed':
    case 'Resolved':            return COLORS.success;
    case 'Declined':
    case 'Rejected':            return COLORS.danger;
    case 'Cancelled':           return COLORS.textMuted;
    default:                    return COLORS.textMuted;
  }
}

function crStatusBg(status: string): string {
  return crStatusColor(status) + '18';
}

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

function PlusIcon({ size = 18, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

function FileIcon({ size = 16, color = COLORS.warning }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
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
  delay?: number;
}

function KPICard({ title, value, icon, accent, bg, delay = 0 }: KPICardProps) {
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

function RevenueRow({ item, displayCurrency, onPress }: { item: RevenueItem; displayCurrency: Currency; onPress: (item: RevenueItem) => void }) {
  const rates: Record<string, number> = { USD: 1, UGX: 3700, KES: 130 };
  const displayed = (item.amount / (rates[item.currency] || 1)) * (rates[displayCurrency] || 1);
  const date = item.date ? new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
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
            <Text style={[styles.sourceBadgeText, { color: '#1d4ed8' }]}>{SOURCE_LABELS[item.source] || item.source}</Text>
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

function ExpenseRow({ item, displayCurrency, onPress }: { item: ExpenseItem; displayCurrency: Currency; onPress: (item: ExpenseItem) => void }) {
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
// CASH REQUISITION CARD
// ============================================================================

function CRCard({ cr, displayCurrency, onPress }: { cr: CashRequisition; displayCurrency: Currency; onPress: (cr: CashRequisition) => void }) {
  const rates: Record<string, number> = { USD: 1, UGX: 3700, KES: 130 };
  const displayed = (cr.total_cost / (rates[cr.currency] || 1)) * (rates[displayCurrency] || 1);
  const dateNeeded = cr.date_needed
    ? new Date(cr.date_needed).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const createdAt = cr.created_at
    ? new Date(cr.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const statusColor = crStatusColor(cr.status);
  const statusBg    = crStatusBg(cr.status);
  const approverName = cr.approver?.full_name || (cr.approver?.email ? cr.approver.email.split('@')[0] : null);

  return (
    <TouchableOpacity style={styles.crCard} onPress={() => onPress(cr)} activeOpacity={0.75}>
      {/* Left accent bar */}
      <View style={[styles.crAccent, { backgroundColor: statusColor }]} />

      <View style={styles.crBody}>
        {/* Top row: CR number + amount */}
        <View style={styles.crTopRow}>
          <View style={styles.crTitleWrap}>
            <FileIcon size={14} color={statusColor} />
            <Text style={styles.crNumber}>{cr.cr_number || 'Cash Requisition'}</Text>
          </View>
          <Text style={[styles.crAmount, { color: statusColor }]}>
            {formatCurrency(displayed, displayCurrency)}
          </Text>
        </View>

        {/* Category + Department */}
        <View style={styles.crBadgeRow}>
          <View style={[styles.crBadge, { backgroundColor: '#fef3c7' }]}>
            <Text style={[styles.crBadgeText, { color: '#92400e' }]}>{cr.expense_category}</Text>
          </View>
          {cr.department ? (
            <View style={[styles.crBadge, { backgroundColor: COLORS.primary + '15' }]}>
              <Text style={[styles.crBadgeText, { color: COLORS.primary }]}>{cr.department}</Text>
            </View>
          ) : null}
          <View style={[styles.crBadge, { backgroundColor: statusBg }]}>
            <Text style={[styles.crBadgeText, { color: statusColor }]}>{cr.status}</Text>
          </View>
        </View>

        {/* Purpose */}
        {(cr.purpose || cr.description) ? (
          <Text style={styles.crPurpose} numberOfLines={1}>
            {cr.purpose || cr.description}
          </Text>
        ) : null}

        {/* Footer: requester · approver · dates */}
        <View style={styles.crFooter}>
          <View style={styles.crFooterLeft}>
            {cr.requester_name ? (
              <Text style={styles.crMeta}>By {cr.requester_name}</Text>
            ) : null}
            {approverName ? (
              <Text style={styles.crMeta}>→ {approverName}</Text>
            ) : null}
          </View>
          <View style={styles.crFooterRight}>
            {dateNeeded ? <Text style={styles.crDate}>Need: {dateNeeded}</Text> : null}
            {createdAt  ? <Text style={styles.crDate}>Raised: {createdAt}</Text> : null}
          </View>
        </View>

        {/* Payee + payment mode */}
        {(cr.payee_name || cr.payment_mode) ? (
          <View style={styles.crPayeeRow}>
            {cr.payee_name ? (
              <Text style={styles.crPayee}>Payee: {cr.payee_name}</Text>
            ) : null}
            {cr.payment_mode ? (
              <View style={[styles.crBadge, { backgroundColor: '#e0f2fe' }]}>
                <Text style={[styles.crBadgeText, { color: '#0369a1' }]}>{cr.payment_mode}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// LOADING / ERROR
// ============================================================================

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

type ActiveTab = 'revenue' | 'expenses' | 'requisitions';

export function FinanceScreen() {
  const { user } = useAuth();
  const [currency,       setCurrency]       = useState<Currency>('USD');
  const [activeTab,      setActiveTab]      = useState<ActiveTab>('revenue');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [crSearchQuery,  setCrSearchQuery]  = useState('');
  const [crStatusFilter, setCrStatusFilter] = useState<'all' | CRStatus>('all');
  const [refreshing,     setRefreshing]     = useState(false);
  const [showAddCR,      setShowAddCR]      = useState(false);

  const [modalItem,    setModalItem]    = useState<FinancialTransaction | CashRequisition | null>(null);
  const [modalType,    setModalType]    = useState<'transaction' | 'cr'>('transaction');
  const [modalVisible, setModalVisible] = useState(false);

  const {
    cashRequisitions,
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

  const filteredCRs = useMemo(() => {
    let list = cashRequisitions;
    if (crStatusFilter !== 'all') {
      list = list.filter(cr => cr.status === crStatusFilter);
    }
    if (crSearchQuery.trim()) {
      const q = crSearchQuery.toLowerCase();
      list = list.filter(cr =>
        (cr.cr_number || '').toLowerCase().includes(q) ||
        (cr.requester_name || '').toLowerCase().includes(q) ||
        (cr.department || '').toLowerCase().includes(q) ||
        (cr.expense_category || '').toLowerCase().includes(q) ||
        (cr.purpose || cr.description || '').toLowerCase().includes(q) ||
        (cr.payee_name || '').toLowerCase().includes(q) ||
        cr.status.toLowerCase().includes(q)
      );
    }
    return list;
  }, [cashRequisitions, crStatusFilter, crSearchQuery]);

  const pendingCount = useMemo(
    () => cashRequisitions.filter(cr => cr.status === 'Pending').length,
    [cashRequisitions]
  );

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleRevenuePress = useCallback((item: RevenueItem) => {
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
      const crId = item.id.replace('cr-', '');
      const fullCR = cashRequisitions.find(cr => cr.id === crId);
      setModalItem(fullCR ?? {
        id:               crId,
        cr_number:        item.reference || crId,
        total_cost:       item.amount,
        currency:         item.currency,
        status:           item.status as CashRequisition['status'],
        date_needed:      item.date,
        expense_category: item.title,
        created_at:       item.date,
        description:      item.subtitle,
      });
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
  }, [cashRequisitions]);

  const handleCRPress = useCallback((cr: CashRequisition) => {
    setModalItem(cr);
    setModalType('cr');
    setModalVisible(true);
  }, []);

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSearchQuery('');
    setCrSearchQuery('');
  };

  // ── Error state ───────────────────────────────────────────────────────────

  if (error && !loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ErrorMessage message={error.message || 'Failed to load financial data'} onRetry={refetch} />
      </SafeAreaView>
    );
  }

  // ── Revenue / Expenses list header ────────────────────────────────────────

  const renderTxHeader = () => (
    <>
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

      <View style={styles.kpiGrid}>
        <KPICard delay={0}   title="Revenue (MTD)"  value={formatCurrency(revenueMTD,  currency)} accent={COLORS.income}  bg={COLORS.revenueBg} icon={<TrendUpIcon   size={15} color={COLORS.income}  />} />
        <KPICard delay={70}  title="Expenses (MTD)" value={formatCurrency(expensesMTD, currency)} accent={COLORS.expense} bg={COLORS.expenseBg} icon={<TrendDownIcon size={15} color={COLORS.expense} />} />
        <KPICard delay={140} title="Net Profit"      value={formatCurrency(netProfitMTD, currency)} accent={netProfitMTD >= 0 ? COLORS.income : COLORS.expense} bg={netProfitMTD >= 0 ? COLORS.revenueBg : '#f5e8ce'} icon={<TrendUpIcon size={15} color={netProfitMTD >= 0 ? COLORS.income : COLORS.expense} />} />
      </View>

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

      <Text style={styles.listCount}>
        {activeTab === 'revenue'
          ? `${filteredRevenue.length} revenue record${filteredRevenue.length !== 1 ? 's' : ''}`
          : `${filteredExpenses.length} expense record${filteredExpenses.length !== 1 ? 's' : ''}`}
      </Text>
    </>
  );

  // ── CR list header ────────────────────────────────────────────────────────

  const renderCRHeader = () => (
    <>
      {/* KPI row for CRs */}
      <View style={styles.kpiGrid}>
        <KPICard delay={0}  title="Total CRs"    value={String(cashRequisitions.length)}  accent={COLORS.warning} bg="#fef3c7" icon={<FileIcon size={15} color={COLORS.warning} />} />
        <KPICard delay={60} title="Pending"       value={String(pendingCount)}             accent={COLORS.warning} bg="#fff7e6" icon={<FileIcon size={15} color={COLORS.warning} />} />
        <KPICard delay={120} title="Completed"    value={String(cashRequisitions.filter(c => c.status === 'Completed' || c.status === 'Resolved').length)} accent={COLORS.success} bg={COLORS.revenueBg} icon={<TrendUpIcon size={15} color={COLORS.success} />} />
      </View>

      {/* New CR button */}
      <TouchableOpacity
        style={styles.newCRBtn}
        onPress={() => setShowAddCR(true)}
        activeOpacity={0.85}
      >
        <PlusIcon size={18} color="#fff" />
        <Text style={styles.newCRBtnText}>New Cash Requisition</Text>
      </TouchableOpacity>

      {/* Status filter chips */}
      <View style={styles.sectionLabelRow}>
        <Text style={styles.sectionLabel}>Filter by Status</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilterScroll} contentContainerStyle={styles.statusFilterContent}>
        {CR_STATUS_FILTERS.map(f => {
          const active = crStatusFilter === f.value;
          const color  = f.value === 'all' ? COLORS.primary : crStatusColor(f.value);
          return (
            <TouchableOpacity
              key={f.value}
              style={[styles.statusChip, active && { backgroundColor: color, borderColor: color }]}
              onPress={() => setCrStatusFilter(f.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.statusChipText, active && { color: '#fff' }]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Search */}
      <View style={[styles.searchRow, { marginTop: 12 }]}>
        <SearchIcon size={17} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search CR#, requester, department, payee..."
          placeholderTextColor={COLORS.textMuted}
          value={crSearchQuery}
          onChangeText={setCrSearchQuery}
        />
      </View>

      <Text style={styles.listCount}>
        {filteredCRs.length} requisition{filteredCRs.length !== 1 ? 's' : ''}
        {crStatusFilter !== 'all' ? ` · ${crStatusFilter}` : ''}
      </Text>
    </>
  );

  const renderRevenueItem  = ({ item, index }: { item: RevenueItem; index: number }) => (
    <FadeSlideIn delay={Math.min(index * 40, 300)} distance={14}>
      <RevenueRow item={item} displayCurrency={currency} onPress={handleRevenuePress} />
    </FadeSlideIn>
  );

  const renderExpenseItem  = ({ item, index }: { item: ExpenseItem; index: number }) => (
    <FadeSlideIn delay={Math.min(index * 40, 300)} distance={14}>
      <ExpenseRow item={item} displayCurrency={currency} onPress={handleExpensePress} />
    </FadeSlideIn>
  );

  const renderCRItem = ({ item, index }: { item: CashRequisition; index: number }) => (
    <FadeSlideIn delay={Math.min(index * 40, 300)} distance={14}>
      <CRCard cr={item} displayCurrency={currency} onPress={handleCRPress} />
    </FadeSlideIn>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>
        {activeTab === 'revenue'     ? 'No revenue records found'
         : activeTab === 'expenses'  ? 'No expense records found'
         : 'No cash requisitions found'}
      </Text>
      <Text style={styles.emptyMessage}>
        {(activeTab === 'requisitions' ? crSearchQuery : searchQuery)
          ? 'Try adjusting your search'
          : activeTab === 'requisitions'
            ? 'Tap "New Cash Requisition" above to raise one'
            : 'Records will appear here once available'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {loading && !refreshing && <LoadingOverlay />}

      {/* Hero header */}
      <FadeSlideIn delay={0} distance={-10}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>Operations</Text>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroTitle}>Finance</Text>
              <Text style={styles.heroSub}>
                {activeTab === 'requisitions' ? 'Cash Requisitions' : 'Revenue & Expenses'}
              </Text>
            </View>
            {activeTab !== 'requisitions' ? (
              <View style={[styles.heroBadge, { backgroundColor: netProfitMTD >= 0 ? '#3d8f6a' : '#c96d4d' }]}>
                <Text style={styles.heroBadgeText}>{netProfitMTD >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(netProfitMTD), currency)}</Text>
              </View>
            ) : pendingCount > 0 ? (
              <View style={[styles.heroBadge, { backgroundColor: COLORS.warning }]}>
                <Text style={styles.heroBadgeText}>{pendingCount} Pending</Text>
              </View>
            ) : null}
          </View>

          {/* 3-tab selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.heroTabsScroll}>
            <View style={styles.heroTabs}>
              {([
                { key: 'revenue',      label: `Revenue (${revenueItems.length})` },
                { key: 'expenses',     label: `Expenses (${expenseItems.length})` },
                { key: 'requisitions', label: `Cash Reqs (${cashRequisitions.length})` },
              ] as { key: ActiveTab; label: string }[]).map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.heroTab, activeTab === t.key && styles.heroTabActive]}
                  onPress={() => handleTabChange(t.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.heroTabText, activeTab === t.key && styles.heroTabTextActive]}>
                    {t.label}
                  </Text>
                  {t.key === 'requisitions' && pendingCount > 0 && (
                    <View style={styles.heroTabDot} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </FadeSlideIn>

      {/* Content */}
      {activeTab === 'revenue' && (
        <FlatList
          data={filteredRevenue}
          keyExtractor={(item: RevenueItem) => item.id}
          renderItem={renderRevenueItem}
          ListHeaderComponent={renderTxHeader}
          ListEmptyComponent={!loading ? renderEmpty : null}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
        />
      )}

      {activeTab === 'expenses' && (
        <FlatList
          data={filteredExpenses}
          keyExtractor={(item: ExpenseItem) => item.id}
          renderItem={renderExpenseItem}
          ListHeaderComponent={renderTxHeader}
          ListEmptyComponent={!loading ? renderEmpty : null}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
        />
      )}

      {activeTab === 'requisitions' && (
        <FlatList
          data={filteredCRs}
          keyExtractor={(item: CashRequisition) => item.id}
          renderItem={renderCRItem}
          ListHeaderComponent={renderCRHeader}
          ListEmptyComponent={!loading ? renderEmpty : null}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
        />
      )}

      <TransactionDetailModal
        item={modalItem}
        itemType={modalType}
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setModalItem(null); }}
        displayCurrency={currency}
        onRefetch={refetch}
      />

      <AddExpenseModal
        visible={showAddCR}
        onClose={() => setShowAddCR(false)}
        onSuccess={() => { setShowAddCR(false); refetch(); }}
        userId={user?.id}
        userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]}
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

  // Hero
  hero:           { backgroundColor: '#171513', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, gap: 12 },
  heroEyebrow:    { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: '#b8ab95' },
  heroRow:        { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  heroTitle:      { fontSize: 28, fontWeight: '800', letterSpacing: -1, color: '#fffaf3' },
  heroSub:        { fontSize: 13, color: '#b8ab95', marginTop: 2 },
  heroBadge:      { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  heroBadgeText:  { color: '#fff', fontSize: 12, fontWeight: '800' },
  heroTabsScroll: { flexGrow: 0 },
  heroTabs:       { flexDirection: 'row', gap: 8, paddingRight: 4 },
  heroTab:        { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroTabActive:  { backgroundColor: '#fffdf9' },
  heroTabText:    { fontSize: 13, fontWeight: '700', color: '#b8ab95' },
  heroTabTextActive: { color: '#181512', fontWeight: '800' },
  heroTabDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.warning },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // Currency
  currencyRow:         { marginBottom: 14 },
  sectionLabel:        { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  sectionLabelRow:     { marginBottom: 4 },
  currencyChips:       { flexDirection: 'row', gap: 8 },
  currencyChip:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  currencyChipActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  currencyChipText:    { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  currencyChipTextActive: { color: '#fff' },

  // KPI
  kpiGrid:     { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpiCard:     { flex: 1, borderRadius: 16, padding: 12, alignItems: 'flex-start' },
  kpiIconWrap: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  kpiTitle:    { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  kpiValue:    { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },

  // New CR button
  newCRBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.danger, borderRadius: 14, paddingVertical: 14, marginBottom: 16 },
  newCRBtnText:  { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.1 },

  // Status filter
  statusFilterScroll:   { flexGrow: 0, marginBottom: 2 },
  statusFilterContent:  { flexDirection: 'row', gap: 8, paddingRight: 4 },
  statusChip:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  statusChipText:       { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },

  // Search
  searchRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10, height: 44, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  listCount:   { fontSize: 12, color: COLORS.textMuted, marginBottom: 10, fontWeight: '500' },

  // Revenue / Expense row cards
  rowCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1, borderWidth: 1, borderColor: COLORS.border },
  rowIconWrap:   { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowInfo:       { flex: 1 },
  rowTitle:      { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  rowSubtitle:   { fontSize: 12, color: COLORS.textMuted, marginBottom: 6 },
  rowMeta:       { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  sourceBadge:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  sourceBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  rowDate:       { fontSize: 10, color: COLORS.textMuted },
  rowAmount:     { fontSize: 14, fontWeight: '800', letterSpacing: -0.3, marginLeft: 8 },

  // CR Card
  crCard:        { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 16, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  crAccent:      { width: 4 },
  crBody:        { flex: 1, padding: 14, gap: 6 },
  crTopRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  crTitleWrap:   { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  crNumber:      { fontSize: 15, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  crAmount:      { fontSize: 16, fontWeight: '800', letterSpacing: -0.4, marginLeft: 8 },
  crBadgeRow:    { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  crBadge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  crBadgeText:   { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  crPurpose:     { fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic' },
  crFooter:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 2 },
  crFooterLeft:  { flex: 1, gap: 2 },
  crFooterRight: { alignItems: 'flex-end', gap: 2 },
  crMeta:        { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  crDate:        { fontSize: 11, color: COLORS.textMuted },
  crPayeeRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  crPayee:       { fontSize: 12, color: COLORS.textMuted, fontWeight: '500', flex: 1 },

  // Loading
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(241,245,249,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  loadingCard:    { backgroundColor: COLORS.card, borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 5 },
  loadingText:    { marginTop: 12, fontSize: 15, fontWeight: '500', color: COLORS.textMuted },

  // Error
  errorContainer:  { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  errorTitle:      { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  errorMessage:    { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginBottom: 16 },
  retryButton:     { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: COLORS.primary, borderRadius: 10 },
  retryButtonText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },

  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle:     { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  emptyMessage:   { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
});

export default FinanceScreen;
