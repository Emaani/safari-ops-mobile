import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Svg, Path, Circle, Rect } from 'react-native-svg';
import { useAuth } from '../contexts/AuthContext';
import { devLog } from '../lib/devLog';

// Hooks
import { useExchangeRate, getConversionRates } from '../hooks/useExchangeRate';
import { useDashboardData } from '../hooks/useDashboardData';
import { useDashboardRealtimeSync } from '../hooks/useDashboardRealtimeSync';
import { useDashboardCalculations } from '../hooks/useDashboardCalculations';

// Components
import { KPICard } from '../components/kpi/KPICard';
import {
  RevenueVsExpensesChart,
  ExpenseCategoriesChart,
  TopVehiclesChart,
  FleetStatusChart,
  CapacityComparisonChart,
} from '../components/charts';
import {
  OutstandingPaymentsCard,
  RecentBookingsWidget,
} from '../components/widgets';

// Forms
import { NewBookingModal, AddExpenseModal, CreateSafariModal } from '../components/forms';

// Utils
import { formatCurrency } from '../lib/utils';

// Types
import type { Currency } from '../types/dashboard';

// ============================================================================
// TYPES
// ============================================================================

type MonthFilter = number | 'all';

// ============================================================================
// CONSTANTS
// ============================================================================

const MONTHS: { label: string; value: MonthFilter }[] = [
  { label: 'All Months', value: 'all' },
  { label: 'January', value: 0 },
  { label: 'February', value: 1 },
  { label: 'March', value: 2 },
  { label: 'April', value: 3 },
  { label: 'May', value: 4 },
  { label: 'June', value: 5 },
  { label: 'July', value: 6 },
  { label: 'August', value: 7 },
  { label: 'September', value: 8 },
  { label: 'October', value: 9 },
  { label: 'November', value: 10 },
  { label: 'December', value: 11 },
];

const CURRENCIES: { label: string; value: Currency }[] = [
  { label: 'USD ($)', value: 'USD' },
  { label: 'UGX', value: 'UGX' },
  { label: 'KES', value: 'KES' },
];

// Generate years from 2020 to current year + 1
const generateYears = (): { label: string; value: number }[] => {
  const thisYear = new Date().getFullYear();
  const years: { label: string; value: number }[] = [];
  for (let year = thisYear + 1; year >= 2020; year--) {
    years.push({ label: String(year), value: year });
  }
  return years;
};
const YEARS = generateYears();

const COLORS = {
  primary: '#1f4d45',
  primarySoft: '#dce8e3',
  success: '#3d8f6a',
  warning: '#b8883f',
  danger: '#c96d4d',
  purple: '#8366d7',
  background: '#f6f2eb',
  card: '#fffdf9',
  cardAlt: '#efe6d8',
  hero: '#171513',
  heroMuted: '#b8ab95',
  text: '#181512',
  textMuted: '#7f7565',
  border: '#e1d7c8',
  gold: '#b78a43',
  goldSoft: '#f2e5ca',
};

// ============================================================================
// ICON COMPONENTS
// ============================================================================

function DollarSignIcon({ size = 24, color = COLORS.success }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2v20" />
      <Path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Svg>
  );
}

function CreditCardIcon({ size = 24, color = COLORS.danger }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <Path d="M1 10h22" />
    </Svg>
  );
}

function TruckIcon({ size = 24, color = COLORS.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 3h15v13H1z" />
      <Path d="M16 8h4l3 3v5h-7V8z" />
      <Circle cx="5.5" cy="18.5" r="2.5" />
      <Circle cx="18.5" cy="18.5" r="2.5" />
    </Svg>
  );
}

function CalendarIcon({ size = 24, color = COLORS.purple }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <Path d="M16 2v4" />
      <Path d="M8 2v4" />
      <Path d="M3 10h18" />
    </Svg>
  );
}

function LogoutIcon({ size = 24, color = COLORS.danger }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Path d="M16 17l5-5-5-5" />
      <Path d="M21 12H9" />
    </Svg>
  );
}

// ============================================================================
// SECTION HEADER COMPONENT
// ============================================================================

interface SectionHeaderProps {
  title: string;
}

function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionEyebrow}>Dashboard</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function FilterChip({ label, selected, onPress }: FilterChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.filterChip, selected && styles.filterChipActive]}
    >
      <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function HeroStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue} numberOfLines={1}>
        {value}
      </Text>
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
        <Text style={styles.loadingText}>Loading dashboard...</Text>
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
        <Text style={styles.errorRetry} onPress={onRetry}>
          Tap to retry
        </Text>
      )}
    </View>
  );
}

// ============================================================================
// MAIN DASHBOARD SCREEN
// ============================================================================

export function DashboardScreen() {
  // ========================================================================
  // STATE
  // ========================================================================

  // Month filter state - simplified to single dropdown
  // Default to current month for better UX
  const [dashboardMonthFilter, setDashboardMonthFilter] = useState<MonthFilter>(() => {
    const currentMonth = new Date().getMonth();
    devLog('[Dashboard] Initializing dashboardMonthFilter to current month:', currentMonth);
    return currentMonth;
  });
  const [dashboardFilterYear, setDashboardFilterYear] = useState<number>(() => {
    const currentYear = new Date().getFullYear();
    devLog('[Dashboard] Initializing dashboardFilterYear to current year:', currentYear);
    return currentYear;
  });
  const [currency, setCurrency] = useState<Currency>('USD');
  const [refreshing, setRefreshing] = useState(false);
  const [showNewBooking,    setShowNewBooking]    = useState(false);
  const [showAddExpense,    setShowAddExpense]    = useState(false);
  const [showCreateSafari,  setShowCreateSafari]  = useState(false);

  // ========================================================================
  // AUTH
  // ========================================================================

  const { signOut, user } = useAuth();

  // ========================================================================
  // HOOKS
  // ========================================================================

  // Exchange rate hook - fetches live rates from database
  const { exchangeRates, loading: exchangeRateLoading } = useExchangeRate();

  // Dashboard data hook
  const {
    vehicles,
    bookings,
    repairs,
    financialTransactions,
    cashRequisitions,
    safariBookings,
    loading: dataLoading,
    error: dataError,
    refetch,
  } = useDashboardData({
    dashboardMonthFilter,
    dashboardFilterYear,
  });

  // Real-time sync hook
  useDashboardRealtimeSync(refetch);

  // Conversion rates - now fully dynamic from database
  const conversionRates = useMemo(
    () => getConversionRates(exchangeRates),
    [exchangeRates]
  );

  // Dashboard calculations hook
  const calculations = useDashboardCalculations({
    vehicles,
    bookings,
    repairs,
    financialTransactions,
    cashRequisitions,
    safariBookings,
    conversionRates,
    displayCurrency: currency,
    dashboardMonthFilter,
    dashboardFilterYear,
  });

  const loading = dataLoading || exchangeRateLoading;

  // CRITICAL DEBUG: Log KPI values whenever they change
  React.useEffect(() => {
    devLog('[Dashboard] ========== KPI VALUES ==========');
    devLog('[Dashboard] Total Revenue:', calculations.kpis.totalRevenue);
    devLog('[Dashboard] Total Expenses:', calculations.kpis.totalExpenses);
    devLog('[Dashboard] Active Bookings:', calculations.kpis.activeBookings);
    devLog('[Dashboard] Fleet Utilization:', calculations.kpis.fleetUtilization + '%');
    devLog('[Dashboard] Revenue MTD:', calculations.kpis.revenueMTD);
    devLog('[Dashboard] Revenue YTD:', calculations.kpis.revenueYTD);
    devLog('[Dashboard] Confirmed Bookings:', calculations.kpis.confirmedBookings);
    devLog('[Dashboard] Pending Bookings:', calculations.kpis.pendingBookings);
    devLog('[Dashboard] Completed Bookings:', calculations.kpis.completedBookings);
    devLog(
      '[Dashboard] Outstanding Payments:',
      calculations.kpis.outstandingPaymentsTotal,
      '(' + calculations.kpis.outstandingPaymentsCount + ' bookings)'
    );
    devLog('[Dashboard] =====================================');

    const hasLoadedCollections =
      !loading &&
      !dataError &&
      (vehicles.length > 0 ||
        bookings.length > 0 ||
        repairs.length > 0 ||
        financialTransactions.length > 0 ||
        cashRequisitions.length > 0 ||
        safariBookings.length > 0);

    if (
      hasLoadedCollections &&
      calculations.kpis.totalRevenue === 0 &&
      calculations.kpis.totalExpenses === 0 &&
      calculations.kpis.activeBookings === 0
    ) {
      console.warn('[Dashboard] WARNING: All KPIs are zero! This suggests data is not being fetched or calculated correctly.');
      console.warn(
        '[Dashboard] Input data counts - Vehicles:',
        vehicles.length,
        'Bookings:',
        bookings.length,
        'Transactions:',
        financialTransactions.length,
        'CRs:',
        cashRequisitions.length
      );
    }
  }, [
    calculations.kpis,
    loading,
    dataError,
    vehicles.length,
    bookings.length,
    repairs.length,
    financialTransactions.length,
    cashRequisitions.length,
    safariBookings.length,
  ]);

  // ========================================================================
  // DERIVED STATE
  // ========================================================================

  const screenWidth = Dimensions.get('window').width;

  // ========================================================================
  // CALLBACKS
  // ========================================================================

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleMonthChange = useCallback((value: MonthFilter) => {
    devLog(
      '[Dashboard] Month filter changed to:',
      value === 'all' ? 'All Months' : MONTHS.find(m => m.value === value)?.label
    );
    setDashboardMonthFilter(value);
  }, []);

  const handleCurrencyChange = useCallback((value: Currency) => {
    setCurrency(value);
  }, []);

  const handleYearChange = useCallback((value: number) => {
    setDashboardFilterYear(value);
  }, []);

  const handleLogout = useCallback(async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('[Dashboard] Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  }, [signOut]);

  // ========================================================================
  // PREPARED DATA
  // ========================================================================

  // KPI values
  const kpiData = calculations.kpis;

  // Get current filter display text
  const filterDisplayText = useMemo(() => {
    if (dashboardMonthFilter === 'all') {
      return `Showing data for all months in ${dashboardFilterYear}`;
    }
    const monthName = MONTHS.find(m => m.value === dashboardMonthFilter)?.label || 'Unknown';
    return `Showing data for ${monthName} ${dashboardFilterYear}`;
  }, [dashboardMonthFilter, dashboardFilterYear]);

  // Format KPI subtitles
  const revenueSubtitle = useMemo(() => {
    const mtd = formatCurrency(kpiData.revenueMTD, currency);
    const ytd = formatCurrency(kpiData.revenueYTD, currency);
    return `MTD: ${mtd} | YTD: ${ytd}`;
  }, [kpiData.revenueMTD, kpiData.revenueYTD, currency]);

  const fleetSubtitle = useMemo(() => {
    return `${kpiData.vehiclesHired} hired | ${kpiData.vehiclesMaintenance} maint. | ${kpiData.vehiclesAvailable} avail.`;
  }, [kpiData.vehiclesHired, kpiData.vehiclesMaintenance, kpiData.vehiclesAvailable]);

  // Prepare expense categories data for chart
  const expenseCategoriesData = useMemo(() => {
    return calculations.expenseCategories.map((item) => ({
      id: item.category,
      name: item.category,
      amount: item.amount,
    }));
  }, [calculations.expenseCategories]);

  // Prepare top vehicles data for chart
  const topVehiclesData = useMemo(() => {
    return calculations.topVehicles.slice(0, 10).map((item) => ({
      id: item.id,
      name: item.name,
      revenue: item.revenue,
      tripCount: item.trips,
      capacity: item.capacity === '7 Seater' ? '7S' : item.capacity === '5 Seater' ? '5S' : 'N/A',
    }));
  }, [calculations.topVehicles]);

  // Prepare fleet status data for chart
  const fleetStatusData = useMemo(() => {
    return calculations.fleetStatus.map((item) => ({
      status: item.status,
      count: item.count,
      color: item.color,
    }));
  }, [calculations.fleetStatus]);

  // Prepare capacity comparison data
  const capacityRevenueData = useMemo(() => {
    const { sevenSeater, fiveSeater } = calculations.capacityComparison;
    return {
      category: 'Revenue',
      sevenSeater: sevenSeater.totalRevenue,
      fiveSeater: fiveSeater.totalRevenue,
    };
  }, [calculations.capacityComparison]);

  const capacityTripData = useMemo(() => {
    const { sevenSeater, fiveSeater } = calculations.capacityComparison;
    return {
      category: 'Trips',
      sevenSeater: sevenSeater.totalTrips,
      fiveSeater: fiveSeater.totalTrips,
    };
  }, [calculations.capacityComparison]);

  // Prepare recent bookings data for widget
  const recentBookingsData = useMemo(() => {
    return calculations.recentBookings.map((booking) => ({
      id: booking.id,
      booking_number: booking.booking_number || `#${booking.id.slice(0, 8)}`,
      start_date: booking.start_date,
      status: booking.status,
      total_cost: booking.amount,
      currency: currency,
    }));
  }, [calculations.recentBookings, currency]);

  // ========================================================================
  // RENDER
  // ========================================================================

  // Show error if data fetch failed
  if (dataError && !loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerGlowLeft} />
          <View style={styles.headerGlowRight} />
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerEyebrow}>Jackal Adventures</Text>
                <Text style={styles.headerTitle}>Operations</Text>
              </View>
            </View>
          </View>
        </View>
        <ErrorMessage
          message={dataError.message || 'Failed to load dashboard data'}
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Loading Overlay */}
      {loading && !refreshing && <LoadingOverlay />}

      {/* Hero Header */}
      <View style={styles.header}>
        <View style={styles.headerGlowLeft} />
        <View style={styles.headerGlowRight} />
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerEyebrow}>Jackal Adventures</Text>
              <Text style={styles.headerTitle}>
                Welcome back,{' '}
                {user?.user_metadata?.full_name?.split(' ')[0] ||
                  user?.email?.split('@')[0] ||
                  'there'}!
              </Text>
              <Text style={styles.headerSubtitle}>
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>Live</Text>
            </View>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <LogoutIcon size={18} color="#b8ab95" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        <View style={styles.heroCard}>
          <View style={styles.heroGlowLeft} />
          <View style={styles.heroGlowRight} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroEyebrow}>Jackal Adventures</Text>
              <Text style={styles.heroTitle}>
                {dashboardMonthFilter === 'all'
                  ? 'All months at a glance'
                  : `${MONTHS.find((month) => month.value === dashboardMonthFilter)?.label} pulse`}
              </Text>
              <Text style={styles.heroSubtitle}>{filterDisplayText}</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{currency}</Text>
            </View>
          </View>

          <Text style={styles.heroValue}>{formatCurrency(kpiData.totalRevenue, currency)}</Text>
          <Text style={styles.heroCaption}>Revenue in focus for the selected period</Text>

          <View style={styles.heroStatsRow}>
            <HeroStat
              label="Costs"
              value={formatCurrency(kpiData.totalExpenses, currency)}
            />
            <HeroStat
              label="Due"
              value={formatCurrency(kpiData.outstandingPaymentsTotal, currency)}
            />
            <HeroStat
              label="Fleet"
              value={`${kpiData.fleetUtilization}%`}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={styles.quickActionBtn} activeOpacity={0.8} onPress={() => setShowNewBooking(true)}>
            <Text style={styles.quickActionEmoji}>🗓</Text>
            <Text style={styles.quickActionLabel}>New Booking</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} activeOpacity={0.8} onPress={() => setShowAddExpense(true)}>
            <Text style={styles.quickActionEmoji}>💰</Text>
            <Text style={styles.quickActionLabel}>Add Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} activeOpacity={0.8} onPress={() => setShowCreateSafari(true)}>
            <Text style={styles.quickActionEmoji}>🌿</Text>
            <Text style={styles.quickActionLabel}>Create Safari</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.controlsCard}>
          <View style={styles.controlsHeader}>
            <View>
              <Text style={styles.controlsEyebrow}>Filters</Text>
              <Text style={styles.controlsTitle}>Refine the snapshot</Text>
            </View>
            <Text style={styles.controlsHint}>Tap to switch</Text>
          </View>

          <Text style={styles.filterLabel}>Month</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {MONTHS.map((month) => (
              <FilterChip
                key={String(month.value)}
                label={month.label}
                selected={dashboardMonthFilter === month.value}
                onPress={() => handleMonthChange(month.value)}
              />
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>Year</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {YEARS.map((year) => (
              <FilterChip
                key={year.label}
                label={year.label}
                selected={dashboardFilterYear === year.value}
                onPress={() => handleYearChange(year.value)}
              />
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>Currency</Text>
          <View style={styles.currencyRow}>
            {CURRENCIES.map((curr) => (
              <FilterChip
                key={curr.value}
                label={curr.label}
                selected={currency === curr.value}
                onPress={() => handleCurrencyChange(curr.value)}
              />
            ))}
          </View>

          <View style={styles.filterStatusContainer}>
            <Text style={styles.filterStatusText}>{filterDisplayText}</Text>
          </View>
        </View>

        {/* Compact metric tiles — 2×2 */}
        <View style={styles.compactKpiGrid}>
          <View style={[styles.compactKpiTile, { backgroundColor: '#dce8e3' }]}>
            <Text style={[styles.compactKpiLabel, { color: '#1f4d45' }]}>Revenue</Text>
            <Text style={[styles.compactKpiValue, { color: '#1f4d45' }]}>
              {formatCurrency(kpiData.totalRevenue, currency)}
            </Text>
            <Text style={[styles.compactKpiSub, { color: '#1f4d45' }]}>
              MTD: {formatCurrency(kpiData.revenueMTD, currency)}
            </Text>
          </View>
          <View style={[styles.compactKpiTile, { backgroundColor: '#fde8e0' }]}>
            <Text style={[styles.compactKpiLabel, { color: '#c96d4d' }]}>Expenses</Text>
            <Text style={[styles.compactKpiValue, { color: '#c96d4d' }]}>
              {formatCurrency(kpiData.totalExpenses, currency)}
            </Text>
            <Text style={[styles.compactKpiSub, { color: '#c96d4d' }]}>
              {currency === 'USD'
                ? formatCurrency(kpiData.totalExpensesUGX, 'UGX')
                : formatCurrency(kpiData.totalExpensesUSD, 'USD')}
            </Text>
          </View>
          <View style={[styles.compactKpiTile, { backgroundColor: '#e8edf5' }]}>
            <Text style={[styles.compactKpiLabel, { color: '#4a7fc1' }]}>Bookings</Text>
            <Text style={[styles.compactKpiValue, { color: '#4a7fc1' }]}>
              {kpiData.activeBookings}
            </Text>
            <Text style={[styles.compactKpiSub, { color: '#4a7fc1' }]}>
              Pending: {kpiData.pendingBookings}
            </Text>
          </View>
          <View style={[styles.compactKpiTile, { backgroundColor: '#f5e8ce' }]}>
            <Text style={[styles.compactKpiLabel, { color: '#b8883f' }]}>Vehicles</Text>
            <Text style={[styles.compactKpiValue, { color: '#b8883f' }]}>
              {kpiData.vehiclesAvailable}
            </Text>
            <Text style={[styles.compactKpiSub, { color: '#b8883f' }]}>
              Available now
            </Text>
          </View>
        </View>

        {/* KPI Cards - 2x2 Grid */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiRow}>
            <KPICard
              title="Total Revenue"
              value={formatCurrency(kpiData.totalRevenue, currency)}
              subtitle={revenueSubtitle}
              icon={<DollarSignIcon size={20} color={COLORS.success} />}
              iconColor={COLORS.success}
              style={styles.kpiCard}
            />
            <KPICard
              title="Total Expenses"
              value={formatCurrency(kpiData.totalExpenses, currency)}
              subtitle={`${currency === 'USD' ? formatCurrency(kpiData.totalExpensesUGX, 'UGX') : formatCurrency(kpiData.totalExpensesUSD, 'USD')}`}
              icon={<CreditCardIcon size={20} color={COLORS.danger} />}
              iconColor={COLORS.danger}
              style={styles.kpiCard}
            />
          </View>
          <View style={styles.kpiRow}>
            <KPICard
              title="Fleet Utilization"
              value={`${kpiData.fleetUtilization}%`}
              subtitle={fleetSubtitle}
              icon={<TruckIcon size={20} color={COLORS.primary} />}
              iconColor={COLORS.primary}
              style={styles.kpiCard}
            />
            <KPICard
              title="Active Bookings"
              value={String(kpiData.activeBookings)}
              subtitle={`${kpiData.confirmedBookings} confirmed | ${kpiData.pendingBookings} pending`}
              icon={<CalendarIcon size={20} color={COLORS.purple} />}
              iconColor={COLORS.purple}
              style={styles.kpiCard}
            />
          </View>
        </View>

        {/* Outstanding Payments Card */}
        <View style={styles.section}>
          <OutstandingPaymentsCard
            amount={kpiData.outstandingPaymentsTotal}
            count={kpiData.outstandingPaymentsCount}
            currency={currency}
            loading={loading}
          />
        </View>

        {/* Recent Bookings Widget */}
        <View style={styles.section}>
          <RecentBookingsWidget
            bookings={recentBookingsData}
            loading={loading}
          />
        </View>

        {/* Fleet Status Chart */}
        <View style={styles.section}>
          <SectionHeader title="Fleet Status" />
          <FleetStatusChart
            data={fleetStatusData}
            loading={loading}
          />
        </View>

        {/* Revenue vs Expenses Chart */}
        <View style={styles.section}>
          <SectionHeader title="Revenue vs Expenses" />
          <RevenueVsExpensesChart
            data={calculations.monthlyRevenueExpenses}
            loading={loading}
            currency={currency}
          />
        </View>

        {/* Expense Categories Chart */}
        <View style={styles.section}>
          <SectionHeader title="Expense Categories" />
          <ExpenseCategoriesChart
            data={expenseCategoriesData}
            loading={loading}
            currency={currency}
          />
        </View>

        {/* Top Revenue Vehicles Chart */}
        <View style={styles.section}>
          <SectionHeader title="Top Revenue Vehicles" />
          <TopVehiclesChart
            data={topVehiclesData}
            loading={loading}
            currency={currency}
          />
        </View>

        {/* Capacity Comparison Charts */}
        <View style={styles.section}>
          <SectionHeader title="Capacity Comparison" />
          <CapacityComparisonChart
            revenueData={capacityRevenueData}
            tripData={capacityTripData}
            loading={loading}
            currency={currency}
          />
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Action Modals */}
      <NewBookingModal
        visible={showNewBooking}
        onClose={() => setShowNewBooking(false)}
        onSuccess={() => { setShowNewBooking(false); refetch(); }}
        vehicles={vehicles}
        userId={user?.id}
      />
      <AddExpenseModal
        visible={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        onSuccess={() => { setShowAddExpense(false); refetch(); }}
        userId={user?.id}
        userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]}
      />
      <CreateSafariModal
        visible={showCreateSafari}
        onClose={() => setShowCreateSafari(false)}
        onSuccess={() => { setShowCreateSafari(false); refetch(); }}
        vehicles={vehicles.map(v => ({ id: v.id, name: `${v.make} ${v.model}`, plate_number: v.license_plate, status: v.status }))}
        userId={user?.id}
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
    backgroundColor: COLORS.hero,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  headerGlowLeft: {
    position: 'absolute',
    top: -30,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#264a42',
    opacity: 0.32,
  },
  headerGlowRight: {
    position: 'absolute',
    right: -40,
    bottom: -20,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#6c5228',
    opacity: 0.2,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 10,
  },
  headerTextContainer: {
    flexDirection: 'column',
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: COLORS.heroMuted,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: '#fffaf3',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#d3c7b5',
    marginTop: 2,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(31,77,69,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(61,143,106,0.4)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#3d8f6a',
  },
  livePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a8d9bc',
    letterSpacing: 0.6,
  },
  logoutButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  quickActionBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    shadowColor: '#201a13',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  quickActionEmoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  // Compact KPI tiles (2x2)
  compactKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  compactKpiTile: {
    width: '48%',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#201a13',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  compactKpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
    opacity: 0.7,
  },
  compactKpiValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: 3,
  },
  compactKpiSub: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.65,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 110,
  },
  heroCard: {
    backgroundColor: COLORS.hero,
    borderRadius: 28,
    padding: 24,
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 9,
  },
  heroGlowLeft: {
    position: 'absolute',
    top: -24,
    left: -10,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#264a42',
    opacity: 0.36,
  },
  heroGlowRight: {
    position: 'absolute',
    right: -34,
    bottom: -18,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#6c5228',
    opacity: 0.22,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 26,
    gap: 12,
  },
  heroTextBlock: {
    flex: 1,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: COLORS.heroMuted,
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -1.2,
    color: '#fffaf3',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#d3c7b5',
  },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroBadgeText: {
    color: '#fff8ef',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  heroValue: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '800',
    letterSpacing: -1.8,
    color: '#fffaf3',
    marginBottom: 8,
  },
  heroCaption: {
    fontSize: 14,
    color: '#cbbca7',
    marginBottom: 18,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroStat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b8ab95',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  heroStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fffaf3',
  },
  controlsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 18,
    shadowColor: '#201a13',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  controlsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  controlsEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  controlsTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: COLORS.text,
  },
  controlsHint: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORS.textMuted,
    marginBottom: 10,
  },
  chipRow: {
    paddingBottom: 10,
    gap: 10,
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.cardAlt,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  filterChipTextActive: {
    color: '#fffdf7',
  },
  filterStatusContainer: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
  },
  filterStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    letterSpacing: 0.1,
  },
  kpiGrid: {
    marginBottom: 18,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
  },
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.gold,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.7,
  },
  bottomSpacer: {
    height: 16,
  },
  // Loading overlay styles
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
  // Error styles
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
  errorRetry: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
});

export default DashboardScreen;
