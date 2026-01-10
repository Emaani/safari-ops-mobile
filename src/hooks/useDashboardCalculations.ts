import { useMemo } from 'react';
import type {
  Vehicle,
  Booking,
  Repair,
  FinancialTransaction,
  CashRequisition,
  SafariBooking,
  Currency,
  TimeFilter,
  MonthlyData,
  ExpenseCategoryData,
  VehicleRevenueData,
  StandardExpenseCategory,
  VehicleCapacity,
} from '../types/dashboard';
import {
  formatCurrency,
  normalizeExpenseCategory,
  normalizeVehicleCapacity,
  getMonthAbbreviation,
} from '../lib/utils';
import {
  convertToBaseCurrency,
  convertFromBaseCurrency,
} from './useExchangeRate';

// ============================================================================
// TYPES
// ============================================================================

export interface DashboardCalculationsProps {
  // Data from useDashboardData
  vehicles: Vehicle[];
  bookings: Booking[];
  repairs: Repair[];
  financialTransactions: FinancialTransaction[];
  cashRequisitions: CashRequisition[];
  safariBookings: SafariBooking[];

  // Exchange rates from useExchangeRate
  conversionRates: Record<Currency, number>;

  // Display currency
  displayCurrency: Currency;

  // Global dashboard filters
  dashboardMonthFilter: number | 'all';
  dashboardFilterYear: number;

  // Independent chart filters
  revenueExpenseTimeFilter?: TimeFilter;
  selectedRevenueExpenseMonths?: number[];
  selectedRevenueExpenseYear?: number;

  expenseCategoryTimeFilter?: TimeFilter;
  selectedExpenseCategoryMonths?: number[];
  selectedExpenseCategoryYear?: number;

  revenueTimeFilter?: TimeFilter;
  selectedRevenueMonths?: number[];
  selectedRevenueYear?: number;
  capacityFilter?: 'all' | '7seater' | '5seater';

  capacityComparisonTimeFilter?: 'all' | 'specific';
  capacityComparisonMonths?: number[];
  capacityComparisonYear?: number;
}

export interface FleetStatusData {
  status: string;
  count: number;
  color: string;
}

export interface CapacityStats {
  count: number;
  totalRevenue: number;
  totalTrips: number;
  avgRevenuePerVehicle: number;
  avgTripsPerVehicle: number;
  vehicles: Array<{
    id: string;
    name: string;
    revenue: number;
    trips: number;
    capacity: string;
  }>;
}

export interface OutstandingPaymentData {
  id: string;
  booking_number?: string;
  client_name: string;
  balance_due: number;
  total_cost: number;
  amount_paid: number;
  start_date: string;
  end_date: string;
  currency: Currency;
}

export interface RecentBookingData {
  id: string;
  booking_number?: string;
  start_date: string;
  end_date: string;
  status: string;
  amount: number;
  client_name: string;
  assigned_vehicle_id?: string;
}

export interface DashboardCalculationsResult {
  // KPIs
  kpis: {
    totalRevenue: number;
    revenueMTD: number;
    revenueYTD: number;
    totalExpenses: number;
    totalExpensesUSD: number;
    totalExpensesUGX: number;
    activeBookings: number;
    confirmedBookings: number;
    pendingBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    inProgressBookings: number;
    totalBookings: number;
    fleetUtilization: number;
    vehiclesHired: number;
    vehiclesMaintenance: number;
    vehiclesAvailable: number;
    totalFleet: number;
    avgBookingValue: number;
    outstandingPaymentsTotal: number;
    outstandingPaymentsCount: number;
  };

  // Chart data
  monthlyRevenueExpenses: MonthlyData[];
  expenseCategories: ExpenseCategoryData[];
  topVehicles: VehicleRevenueData[];
  fleetStatus: FleetStatusData[];

  // Capacity comparison
  capacityComparison: {
    sevenSeater: CapacityStats;
    fiveSeater: CapacityStats;
  };

  // Widgets
  outstandingPayments: OutstandingPaymentData[];
  recentBookings: RecentBookingData[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CR_NUMBER_REGEX = /CR-\d{4}-\d{4}/;
const VALID_CR_STATUSES = ['Completed', 'Approved', 'Resolved'];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a booking is revenue-eligible per web Dashboard logic
 * Revenue = Completed/In-Progress OR Confirmed with payment received
 */
function isRevenueEligible(booking: Booking): boolean {
  return (
    booking.status === 'Completed' ||
    booking.status === 'In-Progress' ||
    (booking.status === 'Confirmed' && booking.amount_paid > 0)
  );
}

/**
 * Check if a CR represents a valid expense
 */
function isValidExpenseCR(cr: CashRequisition): boolean {
  const isValidExpense =
    cr.date_completed !== null ||
    cr.status === 'Completed' ||
    cr.status === 'Approved' ||
    cr.status === 'Resolved';
  const isNotExcluded =
    cr.status !== 'Rejected' &&
    cr.status !== 'Cancelled' &&
    cr.status !== 'Declined';
  return isValidExpense && isNotExcluded;
}

/**
 * Check if a transaction is a CR-linked expense (to avoid double-counting)
 */
function isCRLinkedTransaction(
  transaction: FinancialTransaction,
  validCRNumbers: Set<string>
): boolean {
  const isCRDuplicate =
    transaction.reference_number &&
    validCRNumbers.has(transaction.reference_number);
  const isCRLedger =
    CR_NUMBER_REGEX.test(String(transaction.description ?? '')) ||
    String(transaction.reference_number ?? '').startsWith('CR-');
  return Boolean(isCRDuplicate || isCRLedger);
}

/**
 * Get months to display based on time filter
 */
function getMonthsToDisplay(
  timeFilter: TimeFilter,
  selectedMonths: number[],
  currentMonth: number
): number[] {
  if (timeFilter === 'year') {
    return Array.from({ length: 12 }, (_, i) => i);
  } else if (timeFilter === 'quarter') {
    const currentQuarter = Math.floor(currentMonth / 3);
    return [
      currentQuarter * 3,
      currentQuarter * 3 + 1,
      currentQuarter * 3 + 2,
    ];
  } else if (timeFilter === 'month') {
    return [currentMonth];
  } else {
    return selectedMonths;
  }
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useDashboardCalculations(
  props: DashboardCalculationsProps
): DashboardCalculationsResult {
  const {
    vehicles,
    bookings,
    repairs,
    financialTransactions,
    cashRequisitions,
    safariBookings,
    conversionRates,
    displayCurrency,
    dashboardMonthFilter,
    dashboardFilterYear,
    revenueExpenseTimeFilter = 'year',
    selectedRevenueExpenseMonths = [new Date().getMonth()],
    selectedRevenueExpenseYear = new Date().getFullYear(),
    expenseCategoryTimeFilter = 'year',
    selectedExpenseCategoryMonths = [new Date().getMonth()],
    selectedExpenseCategoryYear = new Date().getFullYear(),
    revenueTimeFilter = 'month',
    selectedRevenueMonths = [new Date().getMonth()],
    selectedRevenueYear = new Date().getFullYear(),
    capacityFilter = 'all',
    capacityComparisonTimeFilter = 'all',
    capacityComparisonMonths = [new Date().getMonth()],
    capacityComparisonYear = new Date().getFullYear(),
  } = props;

  // All calculations memoized for performance
  return useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // CRITICAL DEBUG: Log all inputs to calculations
    console.log('[DashboardCalculations] ========== CALCULATION START ==========');
    console.log('[DashboardCalculations] Input counts:');
    console.log('[DashboardCalculations]   Vehicles:', vehicles.length);
    console.log('[DashboardCalculations]   Bookings:', bookings.length);
    console.log('[DashboardCalculations]   Repairs:', repairs.length);
    console.log('[DashboardCalculations]   Financial Transactions:', financialTransactions.length);
    console.log('[DashboardCalculations]   Cash Requisitions:', cashRequisitions.length);
    console.log('[DashboardCalculations]   Safari Bookings:', safariBookings.length);
    console.log('[DashboardCalculations] Filters:');
    console.log('[DashboardCalculations]   Dashboard Month Filter:', dashboardMonthFilter);
    console.log('[DashboardCalculations]   Dashboard Filter Year:', dashboardFilterYear);
    console.log('[DashboardCalculations]   Display Currency:', displayCurrency);
    console.log('[DashboardCalculations] Conversion Rates:', conversionRates);

    // Helper for dashboard filter matching
    const matchesDashboardFilter = (date: Date): boolean => {
      if (dashboardMonthFilter === 'all') return true;
      return (
        date.getMonth() === dashboardMonthFilter &&
        date.getFullYear() === dashboardFilterYear
      );
    };

    // ========================================================================
    // FILTER DATA BASED ON DASHBOARD MONTH FILTER
    // ========================================================================

    const dashboardFilteredBookings =
      dashboardMonthFilter === 'all'
        ? bookings
        : bookings.filter((b) =>
            matchesDashboardFilter(new Date(b.start_date))
          );

    console.log(`[DashboardCalculations] Dashboard filtered bookings: ${dashboardFilteredBookings.length} of ${bookings.length} total`);
    if (dashboardFilteredBookings.length !== bookings.length) {
      console.log(`[DashboardCalculations] ${bookings.length - dashboardFilteredBookings.length} bookings filtered out by date filter`);
    }

    const dashboardFilteredTransactions =
      dashboardMonthFilter === 'all'
        ? financialTransactions
        : financialTransactions.filter((t) =>
            matchesDashboardFilter(new Date(t.transaction_date))
          );

    const dashboardFilteredCRs = (
      dashboardMonthFilter === 'all'
        ? cashRequisitions
        : cashRequisitions.filter((cr) =>
            matchesDashboardFilter(new Date(cr.created_at))
          )
    ).filter(isValidExpenseCR);

    // ========================================================================
    // CALCULATE KPIS
    // ========================================================================

    // Active Bookings calculation - matches Web Dashboard exactly
    // Uses ALL bookings (not filtered by date) with status-based filter
    const activeBookings = bookings.filter(b =>
      ['Confirmed', 'Active', 'In Progress', 'In-Progress'].includes(b.status)
    ).length;

    const completedBookings = dashboardFilteredBookings.filter(
      (b) => b.status === 'Completed'
    ).length;
    const pendingBookings = dashboardFilteredBookings.filter(
      (b) => b.status === 'Pending'
    ).length;
    const confirmedBookings = dashboardFilteredBookings.filter(
      (b) => b.status === 'Confirmed'
    ).length;
    const cancelledBookings = dashboardFilteredBookings.filter(
      (b) => b.status === 'Cancelled'
    ).length;
    const inProgressBookings = dashboardFilteredBookings.filter(
      (b) => b.status === 'In-Progress'
    ).length;

    // Fleet Utilization Calculation - matches Web Dashboard exactly
    // Primary source: Vehicle status from database (real-time synced)
    // Only counts 'booked' status (not 'rented')
    const vehiclesHiredByStatus = vehicles.filter(
      (v) => v.status === 'booked'
    ).length;
    const vehiclesMaintenance = vehicles.filter(
      (v) => v.status === 'maintenance' || v.status === 'out_of_service'
    ).length;
    const vehiclesAvailable = vehicles.filter(
      (v) => v.status === 'available'
    ).length;
    const totalFleet = vehicles.length;
    const vehiclesHired = vehiclesHiredByStatus;

    // Fleet Utilization = (Vehicles Hired) / (Total Fleet) * 100
    const fleetUtilization =
      totalFleet > 0 ? Math.round((vehiclesHired / totalFleet) * 100) : 0;

    // Revenue MTD - only count bookings with actual payments received
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const revenueMTD = dashboardFilteredBookings
      .filter((b) => {
        const bookingDate = new Date(b.start_date);
        const eligible = isRevenueEligible(b);
        return (
          eligible &&
          b.amount_paid > 0 &&
          (dashboardMonthFilter === 'all'
            ? bookingDate >= startOfMonth && bookingDate <= now
            : true)
        );
      })
      .reduce((sum, b) => {
        const amountInBase = convertToBaseCurrency(
          b.amount_paid,
          b.currency,
          conversionRates
        );
        return sum + amountInBase;
      }, 0);

    const revenueMTDDisplay = convertFromBaseCurrency(
      revenueMTD,
      displayCurrency,
      conversionRates
    );

    // Revenue YTD
    const revenueYTD = dashboardFilteredBookings
      .filter((b) => {
        const eligible = isRevenueEligible(b);
        return (
          eligible &&
          b.amount_paid > 0 &&
          (dashboardMonthFilter === 'all'
            ? new Date(b.start_date).getFullYear() === currentYear
            : true)
        );
      })
      .reduce((sum, b) => {
        const amountInBase = convertToBaseCurrency(
          b.amount_paid,
          b.currency,
          conversionRates
        );
        return sum + amountInBase;
      }, 0);

    const revenueYTDDisplay = convertFromBaseCurrency(
      revenueYTD,
      displayCurrency,
      conversionRates
    );

    // Total Revenue from all sources (filtered)
    // 1. All booking revenue (amount_paid for Completed/In-Progress, or Confirmed with payment received)
    const revenueEligibleBookings = dashboardFilteredBookings
      .filter((b) => isRevenueEligible(b) && b.amount_paid > 0);

    console.log(`[DashboardCalculations] Revenue-eligible bookings breakdown:`);
    revenueEligibleBookings.forEach((b, idx) => {
      console.log(`  [${idx + 1}] Status: ${b.status}, Amount Paid: ${b.amount_paid} ${b.currency}, ID: ${b.id.slice(0, 8)}`);
    });

    const totalBookingRevenue = revenueEligibleBookings
      .reduce((sum, b) => {
        const amountInBase = convertToBaseCurrency(
          b.amount_paid,
          b.currency,
          conversionRates
        );
        console.log(`  Converting ${b.amount_paid} ${b.currency} to base: ${amountInBase} (rate: ${conversionRates[b.currency]})`);
        return sum + amountInBase;
      }, 0);

    console.log(`[DashboardCalculations] Total booking revenue in base currency: ${totalBookingRevenue}`);

    // 2. Safari profit calculation (PRIORITY 1 FIX)
    // Filter safari bookings by dashboard filter
    const dashboardFilteredSafariBookings =
      dashboardMonthFilter === 'all'
        ? safariBookings
        : safariBookings.filter((s) =>
            matchesDashboardFilter(new Date(s.start_date))
          );

    console.log(`[DashboardCalculations] Safari bookings breakdown:`);
    dashboardFilteredSafariBookings.forEach((s, idx) => {
      const revenue = displayCurrency === 'USD' ? (s.total_price_usd || 0) : (s.total_price_ugx || 0);
      const expenses = displayCurrency === 'USD'
        ? (s.total_expenses_usd || 0) + (s.vehicle_hire_cost_usd || 0)
        : (s.total_expenses_ugx || 0) + (s.vehicle_hire_cost_ugx || 0);
      console.log(`  [${idx + 1}] Revenue: ${revenue}, Expenses: ${expenses}, Profit: ${revenue - expenses} (${displayCurrency})`);
    });

    // Safari profit = total_price - (total_expenses + vehicle_hire_cost)
    // Calculate in base currency (USD)
    const totalSafariProfit = dashboardFilteredSafariBookings.reduce((sum, s) => {
      const revenueUSD = s.total_price_usd || 0;
      const expensesUSD = (s.total_expenses_usd || 0) + (s.vehicle_hire_cost_usd || 0);
      const profit = revenueUSD - expensesUSD;
      return sum + profit;
    }, 0);

    console.log(`[DashboardCalculations] Total safari profit (base USD): ${totalSafariProfit}`);

    // 3. Additional income from financial transactions (non-booking revenue, filtered)
    const totalTransactionRevenue = dashboardFilteredTransactions
      .filter((t) => t.transaction_type === 'income')
      .reduce(
        (sum, t) =>
          sum + convertToBaseCurrency(t.amount, t.currency, conversionRates),
        0
      );

    const totalRevenueDisplay = convertFromBaseCurrency(
      totalBookingRevenue + Math.max(0, totalSafariProfit) + totalTransactionRevenue,
      displayCurrency,
      conversionRates
    );

    console.log(`[DashboardCalculations] Total revenue calculation:`);
    console.log(`  Fleet Booking Revenue (base): ${totalBookingRevenue}`);
    console.log(`  Safari Profit (base, raw): ${totalSafariProfit}`);
    console.log(`  Safari Profit (base, clamped): ${Math.max(0, totalSafariProfit)}`);
    console.log(`  Transaction Revenue (base): ${totalTransactionRevenue}`);
    console.log(`  Total (base): ${totalBookingRevenue + Math.max(0, totalSafariProfit) + totalTransactionRevenue}`);
    console.log(`  Display Currency: ${displayCurrency}`);
    console.log(`  Conversion Rate: ${conversionRates[displayCurrency]}`);
    console.log(`  Total Revenue Display: ${totalRevenueDisplay}`);

    // Outstanding Payments - Pending bookings with balance due (matches web dashboard)
    const outstandingPaymentsTotal = dashboardFilteredBookings
      .filter((b) => b.status === 'Pending' && ((b.total_amount || b.total_cost || 0) - b.amount_paid) > 0)
      .reduce((sum, b) => {
        const totalAmt = b.total_amount || b.total_cost || 0;
        const balanceDue = totalAmt - b.amount_paid;
        const balanceInBase = convertToBaseCurrency(
          balanceDue,
          b.currency,
          conversionRates
        );
        return sum + balanceInBase;
      }, 0);

    const outstandingPaymentsDisplay = convertFromBaseCurrency(
      outstandingPaymentsTotal,
      displayCurrency,
      conversionRates
    );

    const outstandingPaymentsCount = dashboardFilteredBookings.filter(
      (b) => b.status === 'Pending' && ((b.total_amount || b.total_cost || 0) - b.amount_paid) > 0
    ).length;

    // Build set of valid CR numbers for deduplication
    const validCRNumbers = new Set(dashboardFilteredCRs.map((cr) => cr.cr_number));

    // Calculate CR expenses - use amount_usd if available, otherwise convert total_cost
    const crExpensesMap = dashboardFilteredCRs.reduce((acc, cr) => {
      const category = normalizeExpenseCategory(cr.expense_category);
      const amountInBase = cr.amount_usd
        ? Number(cr.amount_usd)
        : convertToBaseCurrency(cr.total_cost, cr.currency, conversionRates);
      acc[category] = (acc[category] || 0) + amountInBase;
      return acc;
    }, {} as Record<string, number>);

    // Filter expense transactions - EXCLUDE CR-ledger transactions to prevent double-counting
    const dashboardFilteredExpenseTransactions = dashboardFilteredTransactions.filter(
      (t) =>
        t.transaction_type === 'expense' &&
        t.status !== 'cancelled' &&
        !isCRLinkedTransaction(t, validCRNumbers)
    );

    // Add non-CR-linked transaction expenses
    const expenseCategoriesMap = { ...crExpensesMap };
    dashboardFilteredExpenseTransactions.forEach((t) => {
      const category = normalizeExpenseCategory(t.category || 'Operating Expense');
      const amountInBase = convertToBaseCurrency(
        t.amount,
        t.currency,
        conversionRates
      );
      expenseCategoriesMap[category] = (expenseCategoriesMap[category] || 0) + amountInBase;
    });

    // Calculate total expenses from CRs + non-CR-linked transactions
    const totalExpensesBase = Object.values(expenseCategoriesMap).reduce(
      (sum, amount) => sum + amount,
      0
    );
    const totalExpensesDisplay = convertFromBaseCurrency(
      totalExpensesBase,
      displayCurrency,
      conversionRates
    );

    // Calculate total expenses in both currencies for display
    const totalExpensesUSD = totalExpensesBase;
    const totalExpensesUGX = totalExpensesBase * conversionRates.UGX;

    // Average booking value
    const avgBookingValue =
      bookings.length > 0
        ? bookings.reduce(
            (sum, b) =>
              sum + convertToBaseCurrency((b.total_amount || b.total_cost || 0), b.currency, conversionRates),
            0
          ) / bookings.length
        : 0;
    const avgBookingValueDisplay = convertFromBaseCurrency(
      avgBookingValue,
      displayCurrency,
      conversionRates
    );

    // ========================================================================
    // CALCULATE MONTHLY REVENUE EXPENSES (Line Chart)
    // ========================================================================

    const revenueExpenseMonthsToDisplay = getMonthsToDisplay(
      revenueExpenseTimeFilter,
      selectedRevenueExpenseMonths,
      currentMonth
    );

    const monthlyRevenueExpenses: MonthlyData[] = revenueExpenseMonthsToDisplay.map(
      (monthNum) => {
        const monthDate = new Date(selectedRevenueExpenseYear, monthNum, 1);
        const nextMonthDate = new Date(selectedRevenueExpenseYear, monthNum + 1, 1);
        const monthName = getMonthAbbreviation(monthNum);

        // Monthly booking revenue
        const monthBookingRevenue = bookings
          .filter((b) => {
            const date = new Date(b.start_date);
            return (
              isRevenueEligible(b) &&
              b.amount_paid > 0 &&
              date >= monthDate &&
              date < nextMonthDate
            );
          })
          .reduce(
            (sum, b) =>
              sum + convertToBaseCurrency(b.amount_paid, b.currency, conversionRates),
            0
          );

        // Monthly safari profit
        const monthSafariProfit = safariBookings
          .filter((s) => {
            const date = new Date(s.start_date);
            return date >= monthDate && date < nextMonthDate;
          })
          .reduce((sum, s) => {
            const revenueUSD = s.total_price_usd || 0;
            const expensesUSD = (s.total_expenses_usd || 0) + (s.vehicle_hire_cost_usd || 0);
            return sum + (revenueUSD - expensesUSD);
          }, 0);

        // Monthly transaction revenue
        const monthTransactionRevenue = financialTransactions
          .filter((t) => {
            const date = new Date(t.transaction_date);
            return (
              t.transaction_type === 'income' &&
              date >= monthDate &&
              date < nextMonthDate
            );
          })
          .reduce(
            (sum, t) =>
              sum + convertToBaseCurrency(t.amount, t.currency, conversionRates),
            0
          );

        const monthRevenue = monthBookingRevenue + Math.max(0, monthSafariProfit) + monthTransactionRevenue;

        // Get valid CR numbers for this calculation
        const validCRReferences = new Set(
          cashRequisitions.filter(isValidExpenseCR).map((cr) => cr.cr_number)
        );

        // Monthly CR expenses - use created_at for month assignment
        const monthCRExpenses = cashRequisitions
          .filter((cr) => {
            const date = new Date(cr.created_at);
            return (
              isValidExpenseCR(cr) &&
              date >= monthDate &&
              date < nextMonthDate
            );
          })
          .reduce((sum, cr) => {
            const amountInBase = cr.amount_usd
              ? cr.amount_usd
              : convertToBaseCurrency(cr.total_cost, cr.currency, conversionRates);
            return sum + amountInBase;
          }, 0);

        // Monthly transaction expenses - EXCLUDE CR-linked transactions
        const monthTransactionExpenses = financialTransactions
          .filter((t) => {
            const date = new Date(t.transaction_date);
            return (
              t.transaction_type === 'expense' &&
              t.status !== 'cancelled' &&
              !isCRLinkedTransaction(t, validCRReferences) &&
              date >= monthDate &&
              date < nextMonthDate
            );
          })
          .reduce(
            (sum, t) =>
              sum + convertToBaseCurrency(t.amount, t.currency, conversionRates),
            0
          );

        const monthExpenses = monthCRExpenses + monthTransactionExpenses;

        return {
          month: monthName,
          revenue: Math.round(
            convertFromBaseCurrency(monthRevenue, displayCurrency, conversionRates)
          ),
          expenses: Math.round(
            convertFromBaseCurrency(monthExpenses, displayCurrency, conversionRates)
          ),
        };
      }
    );

    // ========================================================================
    // CALCULATE EXPENSE CATEGORIES (Bar Chart)
    // ========================================================================

    const expenseCategoryMonthsToDisplay = getMonthsToDisplay(
      expenseCategoryTimeFilter,
      selectedExpenseCategoryMonths,
      currentMonth
    );

    // Get filtered CRs for expense categories
    const filteredCRsForCategories = cashRequisitions.filter((cr) => {
      const date = new Date(cr.created_at);
      return (
        isValidExpenseCR(cr) &&
        date.getFullYear() === selectedExpenseCategoryYear &&
        expenseCategoryMonthsToDisplay.includes(date.getMonth())
      );
    });

    // Build expense categories map from filtered CRs
    const filteredExpenseCategoriesMap = filteredCRsForCategories.reduce(
      (acc, cr) => {
        const category = normalizeExpenseCategory(cr.expense_category);
        const amountInBase = cr.amount_usd
          ? cr.amount_usd
          : convertToBaseCurrency(cr.total_cost, cr.currency, conversionRates);
        acc[category] = (acc[category] || 0) + amountInBase;
        return acc;
      },
      {} as Record<string, number>
    );

    const expenseCategories: ExpenseCategoryData[] = Object.entries(
      filteredExpenseCategoriesMap
    )
      .map(([category, amountInBase]) => ({
        category: category as StandardExpenseCategory,
        amount: Math.round(
          convertFromBaseCurrency(amountInBase, displayCurrency, conversionRates)
        ),
      }))
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    // ========================================================================
    // CALCULATE TOP VEHICLES (Dual-Axis Chart)
    // ========================================================================

    const getFilteredBookingsForVehicles = (): Booking[] => {
      const currentQuarter = Math.floor(currentMonth / 3);

      return bookings.filter((b) => {
        if (!b.assigned_vehicle_id) return false;
        if (!isRevenueEligible(b)) return false;

        const startDate = new Date(b.start_date);

        if (revenueTimeFilter === 'year') {
          return startDate.getFullYear() === currentYear;
        } else if (revenueTimeFilter === 'quarter') {
          const bookingQuarter = Math.floor(startDate.getMonth() / 3);
          return (
            startDate.getFullYear() === currentYear &&
            bookingQuarter === currentQuarter
          );
        } else if (revenueTimeFilter === 'specific') {
          return (
            startDate.getFullYear() === selectedRevenueYear &&
            selectedRevenueMonths.includes(startDate.getMonth())
          );
        } else {
          // month
          return (
            startDate.getFullYear() === currentYear &&
            startDate.getMonth() === currentMonth
          );
        }
      });
    };

    const filteredBookingsForVehicles = getFilteredBookingsForVehicles();

    const topRevenueVehicles = filteredBookingsForVehicles.reduce((acc, b) => {
      const vehicleId = b.assigned_vehicle_id!;
      const amountInBase = convertToBaseCurrency(
        b.amount_paid || 0,
        b.currency,
        conversionRates
      );
      acc[vehicleId] = (acc[vehicleId] || 0) + amountInBase;
      return acc;
    }, {} as Record<string, number>);

    const topVehicles: VehicleRevenueData[] = Object.entries(topRevenueVehicles)
      .map(([vehicleId, revenueInBase]) => {
        const vehicle = vehicles.find((v) => v.id === vehicleId);
        const tripCount = filteredBookingsForVehicles.filter(
          (b) => b.assigned_vehicle_id === vehicleId
        ).length;

        // Robust capacity detection
        const rawCapacity = (vehicle?.capacity || '').toString().toLowerCase();
        let normalizedCapacity: VehicleCapacity = 'Other';

        if (
          rawCapacity.includes('7') ||
          rawCapacity === 'large' ||
          rawCapacity === 'suv'
        ) {
          normalizedCapacity = '7 Seater';
        } else if (
          rawCapacity.includes('5') ||
          rawCapacity === 'medium' ||
          rawCapacity === 'sedan'
        ) {
          normalizedCapacity = '5 Seater';
        }

        return {
          id: vehicleId,
          name: vehicle ? vehicle.license_plate : vehicleId.slice(0, 8),
          fullName: vehicle
            ? `${vehicle.make} ${vehicle.model} (${vehicle.license_plate})`
            : 'Unknown',
          revenue: Math.round(
            convertFromBaseCurrency(revenueInBase, displayCurrency, conversionRates)
          ),
          trips: tripCount,
          capacity: normalizedCapacity,
        };
      })
      .filter((v) => {
        // Apply capacity filter
        if (capacityFilter === '7seater') return v.capacity === '7 Seater';
        if (capacityFilter === '5seater') return v.capacity === '5 Seater';
        return true; // 'all' shows everything
      })
      .sort((a, b) => b.revenue - a.revenue);

    // ========================================================================
    // CALCULATE FLEET STATUS (Donut Chart)
    // ========================================================================

    const fleetStatus: FleetStatusData[] = [
      {
        status: 'Available',
        count: vehiclesAvailable,
        color: '#10b981', // green
      },
      {
        status: 'Hired',
        count: vehiclesHired,
        color: '#3b82f6', // blue
      },
      {
        status: 'Maintenance',
        count: vehiclesMaintenance,
        color: '#f59e0b', // amber
      },
    ].filter((item) => item.count > 0);

    // ========================================================================
    // CALCULATE CAPACITY COMPARISON (Comparison Charts)
    // ========================================================================

    const getCapacityComparisonBookings = (): Booking[] => {
      const baseFilter = (b: Booking) => isRevenueEligible(b);

      if (capacityComparisonTimeFilter === 'all') {
        return bookings.filter(baseFilter);
      }

      return bookings.filter((b) => {
        const startDate = new Date(b.start_date);
        return (
          baseFilter(b) &&
          startDate.getFullYear() === capacityComparisonYear &&
          capacityComparisonMonths.includes(startDate.getMonth())
        );
      });
    };

    const capacityComparisonBookings = getCapacityComparisonBookings();

    // Build vehicle revenue map
    const allVehicleRevenueMap = new Map<
      string,
      { revenue: number; trips: number; capacity: string }
    >();

    capacityComparisonBookings
      .filter((b) => b.assigned_vehicle_id)
      .forEach((b) => {
        const vehicleId = b.assigned_vehicle_id!;
        const vehicle = vehicles.find((v) => v.id === vehicleId);
        const revenueInBase = convertToBaseCurrency(
          b.amount_paid,
          b.currency,
          conversionRates
        );

        // Determine capacity - match database format
        const rawCapacity = (vehicle?.capacity || '').toLowerCase();
        let normalizedCapacity = 'Unknown';
        if (
          rawCapacity.includes('7') ||
          rawCapacity === '7_seater' ||
          rawCapacity === 'large' ||
          rawCapacity === 'suv'
        ) {
          normalizedCapacity = '7 Seater';
        } else if (
          rawCapacity.includes('5') ||
          rawCapacity === '5_seater' ||
          rawCapacity === 'medium' ||
          rawCapacity === 'sedan'
        ) {
          normalizedCapacity = '5 Seater';
        }

        const existing = allVehicleRevenueMap.get(vehicleId) || {
          revenue: 0,
          trips: 0,
          capacity: normalizedCapacity,
        };
        allVehicleRevenueMap.set(vehicleId, {
          revenue: existing.revenue + revenueInBase,
          trips: existing.trips + 1,
          capacity: normalizedCapacity,
        });
      });

    // Create vehicle arrays for display in comparison
    const sevenSeaterVehicles: Array<{
      id: string;
      name: string;
      revenue: number;
      trips: number;
      capacity: string;
    }> = [];
    const fiveSeaterVehicles: Array<{
      id: string;
      name: string;
      revenue: number;
      trips: number;
      capacity: string;
    }> = [];

    allVehicleRevenueMap.forEach((data, vehicleId) => {
      const vehicle = vehicles.find((v) => v.id === vehicleId);
      const revenueInDisplayCurrency = Math.round(
        convertFromBaseCurrency(data.revenue, displayCurrency, conversionRates)
      );
      const vehicleData = {
        id: vehicleId,
        name: vehicle ? vehicle.license_plate : vehicleId.slice(0, 8),
        revenue: revenueInDisplayCurrency,
        trips: data.trips,
        capacity: data.capacity,
      };

      if (data.capacity === '7 Seater') {
        sevenSeaterVehicles.push(vehicleData);
      } else if (data.capacity === '5 Seater') {
        fiveSeaterVehicles.push(vehicleData);
      }
    });

    // Calculate stats for each capacity type - match database format
    const totalSevenSeaterFleet = vehicles.filter((v) => {
      const cap = (v.capacity || '').toLowerCase();
      return cap === '7_seater' || cap === '7 seater' || cap.includes('7');
    }).length;
    const totalFiveSeaterFleet = vehicles.filter((v) => {
      const cap = (v.capacity || '').toLowerCase();
      return cap === '5_seater' || cap === '5 seater' || cap.includes('5');
    }).length;

    const sevenSeaterTotalRevenue = sevenSeaterVehicles.reduce(
      (sum, v) => sum + v.revenue,
      0
    );
    const sevenSeaterTotalTrips = sevenSeaterVehicles.reduce(
      (sum, v) => sum + v.trips,
      0
    );

    const fiveSeaterTotalRevenue = fiveSeaterVehicles.reduce(
      (sum, v) => sum + v.revenue,
      0
    );
    const fiveSeaterTotalTrips = fiveSeaterVehicles.reduce(
      (sum, v) => sum + v.trips,
      0
    );

    const sevenSeaterStats: CapacityStats = {
      count: totalSevenSeaterFleet,
      totalRevenue: sevenSeaterTotalRevenue,
      totalTrips: sevenSeaterTotalTrips,
      avgRevenuePerVehicle:
        sevenSeaterVehicles.length > 0
          ? Math.round(sevenSeaterTotalRevenue / sevenSeaterVehicles.length)
          : 0,
      avgTripsPerVehicle:
        sevenSeaterVehicles.length > 0
          ? parseFloat(
              (sevenSeaterTotalTrips / sevenSeaterVehicles.length).toFixed(1)
            )
          : 0,
      vehicles: sevenSeaterVehicles,
    };

    const fiveSeaterStats: CapacityStats = {
      count: totalFiveSeaterFleet,
      totalRevenue: fiveSeaterTotalRevenue,
      totalTrips: fiveSeaterTotalTrips,
      avgRevenuePerVehicle:
        fiveSeaterVehicles.length > 0
          ? Math.round(fiveSeaterTotalRevenue / fiveSeaterVehicles.length)
          : 0,
      avgTripsPerVehicle:
        fiveSeaterVehicles.length > 0
          ? parseFloat(
              (fiveSeaterTotalTrips / fiveSeaterVehicles.length).toFixed(1)
            )
          : 0,
      vehicles: fiveSeaterVehicles,
    };

    // ========================================================================
    // CALCULATE OUTSTANDING PAYMENTS (Widget)
    // ========================================================================
    // FIXED: Use dashboardFilteredBookings to respect month/year filters

    const outstandingPayments: OutstandingPaymentData[] = dashboardFilteredBookings
      .filter((b) => b.status === 'Pending' && ((b.total_amount || b.total_cost || 0) - b.amount_paid) > 0)
      .map((b) => {
        const totalAmt = b.total_amount || b.total_cost || 0;
        const balanceDue = totalAmt - b.amount_paid;
        return {
          id: b.id,
          booking_number: b.booking_number,
          client_name: b.client?.company_name || b.client_name || b.profiles?.full_name || 'Unknown',
          balance_due: convertFromBaseCurrency(
            convertToBaseCurrency(balanceDue, b.currency, conversionRates),
            displayCurrency,
            conversionRates
          ),
          total_cost: convertFromBaseCurrency(
            convertToBaseCurrency(totalAmt, b.currency, conversionRates),
            displayCurrency,
            conversionRates
          ),
          amount_paid: convertFromBaseCurrency(
            convertToBaseCurrency(b.amount_paid, b.currency, conversionRates),
            displayCurrency,
            conversionRates
          ),
          start_date: b.start_date,
          end_date: b.end_date,
          currency: b.currency,
        };
      })
      .sort((a, b) => b.balance_due - a.balance_due);

    // ========================================================================
    // GET RECENT BOOKINGS (Widget)
    // ========================================================================
    // Matches Web Dashboard: Orders by created_at DESC (most recent booking first)
    // Shows ALL bookings regardless of status

    const recentBookings: RecentBookingData[] = bookings
      .filter((b) => b.created_at) // Only include bookings with created_at timestamp
      .sort(
        (a, b) =>
          new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()
      )
      .slice(0, 10)
      .map((b) => ({
        id: b.id,
        booking_number: b.booking_number,
        start_date: b.start_date,
        end_date: b.end_date,
        status: b.status,
        amount: convertFromBaseCurrency(
          convertToBaseCurrency((b.total_amount || b.total_cost || 0), b.currency, conversionRates),
          displayCurrency,
          conversionRates
        ),
        client_name: b.client?.company_name || b.client_name || b.profiles?.full_name || 'Unknown',
        assigned_vehicle_id: b.assigned_vehicle_id,
      }));

    // ========================================================================
    // RETURN RESULT
    // ========================================================================

    return {
      kpis: {
        totalRevenue: Math.round(totalRevenueDisplay),
        revenueMTD: Math.round(revenueMTDDisplay),
        revenueYTD: Math.round(revenueYTDDisplay),
        totalExpenses: Math.round(totalExpensesDisplay),
        totalExpensesUSD: Math.round(totalExpensesUSD),
        totalExpensesUGX: Math.round(totalExpensesUGX),
        activeBookings,
        confirmedBookings,
        pendingBookings,
        completedBookings,
        cancelledBookings,
        inProgressBookings,
        totalBookings: dashboardFilteredBookings.length,
        fleetUtilization,
        vehiclesHired,
        vehiclesMaintenance,
        vehiclesAvailable,
        totalFleet,
        avgBookingValue: Math.round(avgBookingValueDisplay),
        outstandingPaymentsTotal: Math.round(outstandingPaymentsDisplay),
        outstandingPaymentsCount,
      },
      monthlyRevenueExpenses,
      expenseCategories,
      topVehicles,
      fleetStatus,
      capacityComparison: {
        sevenSeater: sevenSeaterStats,
        fiveSeater: fiveSeaterStats,
      },
      outstandingPayments,
      recentBookings,
    };
  }, [
    vehicles,
    bookings,
    repairs,
    financialTransactions,
    cashRequisitions,
    safariBookings,
    conversionRates,
    displayCurrency,
    dashboardMonthFilter,
    dashboardFilterYear,
    revenueExpenseTimeFilter,
    selectedRevenueExpenseMonths,
    selectedRevenueExpenseYear,
    expenseCategoryTimeFilter,
    selectedExpenseCategoryMonths,
    selectedExpenseCategoryYear,
    revenueTimeFilter,
    selectedRevenueMonths,
    selectedRevenueYear,
    capacityFilter,
    capacityComparisonTimeFilter,
    capacityComparisonMonths,
    capacityComparisonYear,
  ]);
}
