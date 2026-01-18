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
import { Picker } from '@react-native-picker/picker';
import { Svg, Path, Circle, Rect } from 'react-native-svg';
import { useAuth } from '../contexts/AuthContext';

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

// Utils
import { formatCurrency } from '../lib/utils';

// Types
import type { Currency } from '../types/dashboard';

// ============================================================================
// TYPES
// ============================================================================

type MonthFilter = number | 'all';
type FilterMode = 'all-time' | 'per-month';

// ============================================================================
// CONSTANTS
// ============================================================================

const MONTHS = [
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
  primary: '#3b82f6',
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
      <Text style={styles.sectionTitle}>{title}</Text>
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

  // Filter mode state ('all-time' or 'per-month')
  const [filterMode, setFilterMode] = useState<FilterMode>('per-month');

  // CRITICAL FIX: Default to current month instead of 'all' to match web Dashboard behavior
  const [dashboardMonthFilter, setDashboardMonthFilter] = useState<MonthFilter>(() => {
    const currentMonth = new Date().getMonth();
    console.log('[Dashboard] Initializing dashboardMonthFilter to current month:', currentMonth);
    return currentMonth;
  });
  const [dashboardFilterYear, setDashboardFilterYear] = useState<number>(() => {
    const currentYear = new Date().getFullYear();
    console.log('[Dashboard] Initializing dashboardFilterYear to current year:', currentYear);
    return currentYear;
  });
  const [currency, setCurrency] = useState<Currency>('USD');
  const [refreshing, setRefreshing] = useState(false);

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

  // CRITICAL DEBUG: Log KPI values whenever they change
  React.useEffect(() => {
    console.log('[Dashboard] ========== KPI VALUES ==========');
    console.log('[Dashboard] Total Revenue:', calculations.kpis.totalRevenue);
    console.log('[Dashboard] Total Expenses:', calculations.kpis.totalExpenses);
    console.log('[Dashboard] Active Bookings:', calculations.kpis.activeBookings);
    console.log('[Dashboard] Fleet Utilization:', calculations.kpis.fleetUtilization + '%');
    console.log('[Dashboard] Revenue MTD:', calculations.kpis.revenueMTD);
    console.log('[Dashboard] Revenue YTD:', calculations.kpis.revenueYTD);
    console.log('[Dashboard] Confirmed Bookings:', calculations.kpis.confirmedBookings);
    console.log('[Dashboard] Pending Bookings:', calculations.kpis.pendingBookings);
    console.log('[Dashboard] Completed Bookings:', calculations.kpis.completedBookings);
    console.log('[Dashboard] Outstanding Payments:', calculations.kpis.outstandingPaymentsTotal, '(' + calculations.kpis.outstandingPaymentsCount + ' bookings)');
    console.log('[Dashboard] =====================================');

    // CRITICAL: Log if KPIs are all zero (indicates data issue)
    if (calculations.kpis.totalRevenue === 0 && calculations.kpis.totalExpenses === 0 && calculations.kpis.activeBookings === 0) {
      console.warn('[Dashboard] WARNING: All KPIs are zero! This suggests data is not being fetched or calculated correctly.');
      console.warn('[Dashboard] Input data counts - Vehicles:', vehicles.length, 'Bookings:', bookings.length, 'Transactions:', financialTransactions.length, 'CRs:', cashRequisitions.length);
    }
  }, [calculations.kpis, vehicles.length, bookings.length, financialTransactions.length, cashRequisitions.length]);

  // ========================================================================
  // DERIVED STATE
  // ========================================================================

  const loading = dataLoading || exchangeRateLoading;
  const screenWidth = Dimensions.get('window').width;

  // ========================================================================
  // CALLBACKS
  // ========================================================================

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleFilterModeChange = useCallback((mode: FilterMode) => {
    setFilterMode(mode);
    if (mode === 'all-time') {
      setDashboardMonthFilter('all');
      console.log('[Dashboard] Filter mode changed to All Time');
    } else {
      // When switching to per-month, default to current month
      const currentMonth = new Date().getMonth();
      setDashboardMonthFilter(currentMonth);
      console.log('[Dashboard] Filter mode changed to Per Month, defaulting to month:', currentMonth);
    }
  }, []);

  const handleMonthChange = useCallback((value: MonthFilter) => {
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
          <Text style={styles.headerTitle}>Dashboard</Text>
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

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Dashboard</Text>
            {user && <Text style={styles.headerSubtitle}>{user.email}</Text>}
          </View>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <LogoutIcon size={20} color="#fff" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
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
        {/* Filter Section */}
        <View style={styles.filterContainer}>
          {/* Filter by Month - Two-tier dropdown */}
          <View style={styles.pickerWrapper}>
            <Text style={styles.pickerLabel}>Filter by Month</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={filterMode}
                onValueChange={handleFilterModeChange}
                style={styles.picker}
                dropdownIconColor={COLORS.textMuted}
              >
                <Picker.Item label="All Time" value="all-time" />
                <Picker.Item label="Per Month" value="per-month" />
              </Picker>
            </View>

            {/* Secondary month and year selectors - only shown when Per Month is selected */}
            {filterMode === 'per-month' && (
              <View style={styles.monthYearRow}>
                <View style={[styles.pickerContainer, styles.secondaryPicker, styles.monthPicker]}>
                  <Picker
                    selectedValue={dashboardMonthFilter}
                    onValueChange={handleMonthChange}
                    style={styles.picker}
                    dropdownIconColor={COLORS.textMuted}
                  >
                    {MONTHS.filter(m => m.value !== 'all').map((month) => (
                      <Picker.Item
                        key={String(month.value)}
                        label={month.label}
                        value={month.value}
                      />
                    ))}
                  </Picker>
                </View>
                <View style={[styles.pickerContainer, styles.secondaryPicker, styles.yearPicker]}>
                  <Picker
                    selectedValue={dashboardFilterYear}
                    onValueChange={handleYearChange}
                    style={styles.picker}
                    dropdownIconColor={COLORS.textMuted}
                  >
                    {YEARS.map((year) => (
                      <Picker.Item
                        key={year.value}
                        label={year.label}
                        value={year.value}
                      />
                    ))}
                  </Picker>
                </View>
              </View>
            )}
          </View>

          {/* Currency Picker */}
          <View style={styles.pickerWrapper}>
            <Text style={styles.pickerLabel}>Currency</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={currency}
                onValueChange={handleCurrencyChange}
                style={styles.picker}
                dropdownIconColor={COLORS.textMuted}
              >
                {CURRENCIES.map((curr) => (
                  <Picker.Item
                    key={curr.value}
                    label={curr.label}
                    value={curr.value}
                  />
                ))}
              </Picker>
            </View>
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.danger,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  pickerWrapper: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  secondaryPicker: {
    marginTop: 8,
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  monthYearRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  monthPicker: {
    flex: 2,
    marginTop: 0,
  },
  yearPicker: {
    flex: 1,
    marginTop: 0,
  },
  picker: {
    height: 48,
    color: COLORS.text,
    backgroundColor: 'transparent',
  },
  kpiGrid: {
    marginBottom: 16,
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
    marginBottom: 16,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  bottomSpacer: {
    height: 32,
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
