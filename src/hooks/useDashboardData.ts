import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Vehicle,
  Booking,
  Repair,
  FinancialTransaction,
  CashRequisition,
  SafariBooking,
  Currency,
} from '../types/dashboard';
import { matchesDashboardFilter } from '../lib/utils';

interface DashboardDataState {
  vehicles: Vehicle[];
  bookings: Booking[];
  repairs: Repair[];
  financialTransactions: FinancialTransaction[];
  cashRequisitions: CashRequisition[];
  safariBookings: SafariBooking[];
  profiles: Record<string, string>; // user_id -> full_name
  clients: Record<string, string>; // client_id -> company_name
  loading: boolean;
  error: Error | null;
}

interface UseDashboardDataProps {
  dashboardMonthFilter: number | 'all';
  dashboardFilterYear: number;
}

// Generate a unique fetch ID for debugging
let fetchCounter = 0;

export function useDashboardData({
  dashboardMonthFilter,
  dashboardFilterYear,
}: UseDashboardDataProps) {
  const [data, setData] = useState<DashboardDataState>({
    vehicles: [],
    bookings: [],
    repairs: [],
    financialTransactions: [],
    cashRequisitions: [],
    safariBookings: [],
    profiles: {},
    clients: {},
    loading: true,
    error: null,
  });

  // Track if initial fetch has been done to prevent duplicate fetches
  const hasFetchedRef = useRef(false);
  const lastFilterRef = useRef({ month: dashboardMonthFilter, year: dashboardFilterYear });

  // Fetch Vehicles (no filter needed)
  const fetchVehicles = useCallback(async (fetchId: number) => {
    console.log(`[DashboardData #${fetchId}] Fetching vehicles...`);
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('id, license_plate, make, model, capacity, status, rating, current_driver_id, drivers(full_name)')
      .order('license_plate', { ascending: true });

    if (error) {
      console.error(`[DashboardData #${fetchId}] ERROR fetching vehicles:`, error.message, error.details, error.hint);
      throw error;
    }

    const result = (vehicles || []).map(v => ({
      ...v,
      drivers: v.drivers && Array.isArray(v.drivers) && v.drivers.length > 0
        ? { full_name: v.drivers[0].full_name }
        : undefined,
    })) as Vehicle[];

    console.log(`[DashboardData #${fetchId}] Fetched ${result.length} vehicles`);
    if (result.length > 0) {
      console.log(`[DashboardData #${fetchId}] Vehicle statuses:`, result.map(v => v.status).reduce((acc, s) => {
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {} as Record<string, number>));
    }

    return result;
  }, []);

  // Fetch Bookings (with dashboard filter)
  const fetchBookings = useCallback(async (fetchId: number) => {
    console.log(`[DashboardData #${fetchId}] Fetching bookings... (filter: month=${dashboardMonthFilter}, year=${dashboardFilterYear})`);

    let query = supabase
      .from('bookings')
      .select(
        'id, booking_reference, start_date, end_date, status, amount_paid, total_amount, currency, assigned_vehicle_id, assigned_to, client_id, client_name, created_at'
      )
      .order('start_date', { ascending: false });

    // Apply dashboard month filter
    if (dashboardMonthFilter !== 'all') {
      const year = dashboardFilterYear;
      const month = dashboardMonthFilter;
      const firstDay = new Date(year, month, 1).toISOString();
      const lastDay = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      console.log(`[DashboardData #${fetchId}] Bookings date filter: ${firstDay} to ${lastDay}`);
      query = query.gte('start_date', firstDay).lte('start_date', lastDay);
    } else {
      console.log(`[DashboardData #${fetchId}] Bookings: NO date filter (all months)`);
    }

    const { data: bookings, error } = await query;

    if (error) {
      console.error(`[DashboardData #${fetchId}] ERROR fetching bookings:`, error.message, error.details, error.hint);
      throw error;
    }

    // Map database columns to app interface with aliases for backwards compatibility
    const result = (bookings || []).map(b => ({
      ...b,
      booking_number: b.booking_reference, // Alias for backwards compatibility
      total_cost: b.total_amount, // Alias for backwards compatibility
    })) as Booking[];

    console.log(`[DashboardData #${fetchId}] Fetched ${result.length} bookings`);

    if (result.length > 0) {
      // Log booking statuses breakdown
      const statusBreakdown = result.reduce((acc, b) => {
        acc[b.status] = (acc[b.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`[DashboardData #${fetchId}] Booking statuses:`, statusBreakdown);

      // Log revenue-eligible bookings
      const revenueEligible = result.filter(b =>
        b.status === 'Completed' ||
        b.status === 'In-Progress' ||
        (b.status === 'Confirmed' && b.amount_paid > 0)
      );
      console.log(`[DashboardData #${fetchId}] Revenue-eligible bookings: ${revenueEligible.length}`);

      // Log total amount_paid
      const totalAmountPaid = result.reduce((sum, b) => sum + (b.amount_paid || 0), 0);
      console.log(`[DashboardData #${fetchId}] Total amount_paid (raw): ${totalAmountPaid}`);
    }

    return result;
  }, [dashboardMonthFilter, dashboardFilterYear]);

  // Fetch Repairs (active only)
  const fetchRepairs = useCallback(async (fetchId: number) => {
    console.log(`[DashboardData #${fetchId}] Fetching repairs...`);
    const { data: repairs, error } = await supabase
      .from('repairs')
      .select('id, vehicle_id, description, status, priority, reported_at, estimated_cost, vehicles(license_plate)')
      .in('status', ['open', 'in_progress'])
      .order('priority', { ascending: false })
      .order('reported_at', { ascending: false });

    if (error) {
      console.error(`[DashboardData #${fetchId}] ERROR fetching repairs:`, error.message, error.details, error.hint);
      throw error;
    }

    const result = (repairs || []).map(r => ({
      ...r,
      vehicles: r.vehicles && Array.isArray(r.vehicles) && r.vehicles.length > 0
        ? { license_plate: r.vehicles[0].license_plate }
        : undefined,
    })) as Repair[];
    console.log(`[DashboardData #${fetchId}] Fetched ${result.length} repairs`);
    return result;
  }, []);

  // Fetch Financial Transactions (with dashboard filter)
  const fetchTransactions = useCallback(async (fetchId: number) => {
    console.log(`[DashboardData #${fetchId}] Fetching transactions... (filter: month=${dashboardMonthFilter}, year=${dashboardFilterYear})`);

    let query = supabase
      .from('financial_transactions')
      .select('id, transaction_date, amount, transaction_type, category, currency, description, reference_number, status')
      .neq('status', 'cancelled')
      .order('transaction_date', { ascending: true });

    // Apply dashboard month filter
    if (dashboardMonthFilter !== 'all') {
      const year = dashboardFilterYear;
      const month = dashboardMonthFilter;
      const firstDay = new Date(year, month, 1).toISOString();
      const lastDay = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      console.log(`[DashboardData #${fetchId}] Transactions date filter: ${firstDay} to ${lastDay}`);
      query = query.gte('transaction_date', firstDay).lte('transaction_date', lastDay);
    } else {
      console.log(`[DashboardData #${fetchId}] Transactions: NO date filter (all months)`);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error(`[DashboardData #${fetchId}] ERROR fetching transactions:`, error.message, error.details, error.hint);
      throw error;
    }

    const result = (transactions || []) as FinancialTransaction[];
    console.log(`[DashboardData #${fetchId}] Fetched ${result.length} transactions`);

    if (result.length > 0) {
      // Log transaction type breakdown
      const typeBreakdown = result.reduce((acc, t) => {
        acc[t.transaction_type] = (acc[t.transaction_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`[DashboardData #${fetchId}] Transaction types:`, typeBreakdown);

      // Log income vs expense totals
      const incomeTotal = result.filter(t => t.transaction_type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expenseTotal = result.filter(t => t.transaction_type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      console.log(`[DashboardData #${fetchId}] Transaction income total: ${incomeTotal}, expense total: ${expenseTotal}`);
    }

    return result;
  }, [dashboardMonthFilter, dashboardFilterYear]);

  // Fetch Cash Requisitions (with dashboard filter)
  const fetchCashRequisitions = useCallback(async (fetchId: number) => {
    console.log(`[DashboardData #${fetchId}] Fetching cash requisitions... (filter: month=${dashboardMonthFilter}, year=${dashboardFilterYear})`);

    let query = supabase
      .from('cash_requisitions')
      .select('id, cr_number, total_cost, currency, status, date_needed, expense_category, date_completed, created_at, amount_usd')
      .eq('soft_deleted', false)
      .not('status', 'in', '(Declined,Rejected)')
      .order('created_at', { ascending: true });

    // Apply dashboard month filter on created_at
    if (dashboardMonthFilter !== 'all') {
      const year = dashboardFilterYear;
      const month = dashboardMonthFilter;
      const firstDay = new Date(year, month, 1).toISOString();
      const lastDay = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      console.log(`[DashboardData #${fetchId}] CRs date filter: ${firstDay} to ${lastDay}`);
      query = query.gte('created_at', firstDay).lte('created_at', lastDay);
    } else {
      console.log(`[DashboardData #${fetchId}] CRs: NO date filter (all months)`);
    }

    const { data: crs, error } = await query;

    if (error) {
      console.error(`[DashboardData #${fetchId}] ERROR fetching CRs:`, error.message, error.details, error.hint);
      throw error;
    }

    const result = (crs || []) as CashRequisition[];
    console.log(`[DashboardData #${fetchId}] Fetched ${result.length} CRs`);

    if (result.length > 0) {
      // Log CR status breakdown
      const statusBreakdown = result.reduce((acc, cr) => {
        acc[cr.status] = (acc[cr.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`[DashboardData #${fetchId}] CR statuses:`, statusBreakdown);

      // Log valid expense CRs (Completed/Approved/Resolved or has date_completed)
      const validExpenseCRs = result.filter(cr =>
        cr.date_completed !== null ||
        cr.status === 'Completed' ||
        cr.status === 'Approved' ||
        cr.status === 'Resolved'
      );
      console.log(`[DashboardData #${fetchId}] Valid expense CRs: ${validExpenseCRs.length}`);

      // Log total CR expense amount
      const totalCRExpense = validExpenseCRs.reduce((sum, cr) => sum + (cr.amount_usd || cr.total_cost || 0), 0);
      console.log(`[DashboardData #${fetchId}] Total CR expense (raw): ${totalCRExpense}`);
    }

    return result;
  }, [dashboardMonthFilter, dashboardFilterYear]);

  // Fetch Profiles (for assigned user names)
  const fetchProfiles = useCallback(async (fetchId: number) => {
    console.log(`[DashboardData #${fetchId}] Fetching profiles...`);
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name');

    if (error) {
      console.error(`[DashboardData #${fetchId}] ERROR fetching profiles:`, error.message, error.details, error.hint);
      throw error;
    }

    const profileMap: Record<string, string> = {};
    (profiles || []).forEach(p => {
      profileMap[p.id] = p.full_name;
    });

    console.log(`[DashboardData #${fetchId}] Fetched ${Object.keys(profileMap).length} profiles`);
    return profileMap;
  }, []);

  // Fetch Clients (for company names)
  const fetchClients = useCallback(async (fetchId: number) => {
    console.log(`[DashboardData #${fetchId}] Fetching clients...`);
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, company_name');

    if (error) {
      console.error(`[DashboardData #${fetchId}] ERROR fetching clients:`, error.message, error.details, error.hint);
      throw error;
    }

    const clientMap: Record<string, string> = {};
    (clients || []).forEach(c => {
      clientMap[c.id] = c.company_name;
    });

    console.log(`[DashboardData #${fetchId}] Fetched ${Object.keys(clientMap).length} clients`);
    return clientMap;
  }, []);

  // Fetch Safari Bookings (with dashboard filter) - PRIORITY 1 FIX
  const fetchSafariBookings = useCallback(async (fetchId: number) => {
    console.log(`[DashboardData #${fetchId}] Fetching safari bookings... (filter: month=${dashboardMonthFilter}, year=${dashboardFilterYear})`);

    let query = supabase
      .from('safari_bookings')
      .select('id, total_price_usd, total_price_ugx, total_expenses_usd, total_expenses_ugx, vehicle_hire_cost_usd, vehicle_hire_cost_ugx, start_date, end_date, amount_paid, currency')
      .order('start_date', { ascending: false });

    // Apply dashboard month filter on start_date (same as bookings)
    if (dashboardMonthFilter !== 'all') {
      const year = dashboardFilterYear;
      const month = dashboardMonthFilter;
      const firstDay = new Date(year, month, 1).toISOString();
      const lastDay = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      console.log(`[DashboardData #${fetchId}] Safari bookings date filter: ${firstDay} to ${lastDay}`);
      query = query.gte('start_date', firstDay).lte('start_date', lastDay);
    } else {
      console.log(`[DashboardData #${fetchId}] Safari bookings: NO date filter (all months)`);
    }

    const { data: safariBookings, error } = await query;

    if (error) {
      console.error(`[DashboardData #${fetchId}] ERROR fetching safari bookings:`, error.message, error.details, error.hint);
      // Don't throw - safari_bookings table might not exist yet, just return empty array
      console.warn(`[DashboardData #${fetchId}] Continuing without safari bookings (table may not exist)`);
      return [] as SafariBooking[];
    }

    const result = (safariBookings || []) as SafariBooking[];
    console.log(`[DashboardData #${fetchId}] Fetched ${result.length} safari bookings`);

    if (result.length > 0) {
      // Log safari revenue summary
      const totalSafariRevenue = result.reduce((sum, s) => sum + (s.total_price_usd || 0), 0);
      const totalSafariExpenses = result.reduce((sum, s) => sum + ((s.total_expenses_usd || 0) + (s.vehicle_hire_cost_usd || 0)), 0);
      const safariProfit = totalSafariRevenue - totalSafariExpenses;
      console.log(`[DashboardData #${fetchId}] Safari revenue (USD): ${totalSafariRevenue}, expenses: ${totalSafariExpenses}, profit: ${safariProfit}`);
    }

    return result;
  }, [dashboardMonthFilter, dashboardFilterYear]);

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    // Generate unique fetch ID for this fetch cycle
    const fetchId = ++fetchCounter;

    // Check if filters changed
    const filtersChanged =
      lastFilterRef.current.month !== dashboardMonthFilter ||
      lastFilterRef.current.year !== dashboardFilterYear;

    console.log(`[DashboardData #${fetchId}] ========== FETCH START ==========`);
    console.log(`[DashboardData #${fetchId}] Filter: month=${dashboardMonthFilter}, year=${dashboardFilterYear}`);
    console.log(`[DashboardData #${fetchId}] Filters changed: ${filtersChanged}`);
    console.log(`[DashboardData #${fetchId}] Has fetched before: ${hasFetchedRef.current}`);

    // Update last filter ref
    lastFilterRef.current = { month: dashboardMonthFilter, year: dashboardFilterYear };

    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      console.log(`[DashboardData #${fetchId}] Starting parallel fetches...`);
      const startTime = Date.now();

      const [
        vehicles,
        bookings,
        repairs,
        transactions,
        crs,
        safariBookings,
        profiles,
        clients,
      ] = await Promise.all([
        fetchVehicles(fetchId),
        fetchBookings(fetchId),
        fetchRepairs(fetchId),
        fetchTransactions(fetchId),
        fetchCashRequisitions(fetchId),
        fetchSafariBookings(fetchId),
        fetchProfiles(fetchId),
        fetchClients(fetchId),
      ]);

      const fetchDuration = Date.now() - startTime;
      console.log(`[DashboardData #${fetchId}] All fetches completed in ${fetchDuration}ms`);

      // Log summary of fetched data
      console.log(`[DashboardData #${fetchId}] ========== FETCH SUMMARY ==========`);
      console.log(`[DashboardData #${fetchId}] Vehicles: ${vehicles.length}`);
      console.log(`[DashboardData #${fetchId}] Bookings: ${bookings.length}`);
      console.log(`[DashboardData #${fetchId}] Repairs: ${repairs.length}`);
      console.log(`[DashboardData #${fetchId}] Transactions: ${transactions.length}`);
      console.log(`[DashboardData #${fetchId}] CRs: ${crs.length}`);
      console.log(`[DashboardData #${fetchId}] Safari Bookings: ${safariBookings.length}`);
      console.log(`[DashboardData #${fetchId}] Profiles: ${Object.keys(profiles).length}`);
      console.log(`[DashboardData #${fetchId}] Clients: ${Object.keys(clients).length}`);

      // CRITICAL: Check if data is empty
      if (bookings.length === 0) {
        console.warn(`[DashboardData #${fetchId}] WARNING: No bookings returned! Check Supabase connection and RLS policies.`);
      }
      if (crs.length === 0) {
        console.warn(`[DashboardData #${fetchId}] WARNING: No CRs returned! Check Supabase connection and RLS policies.`);
      }

      // Map assigned user names to bookings
      const bookingsWithNames = bookings.map(b => ({
        ...b,
        profiles: b.assigned_user_id && profiles[b.assigned_user_id]
          ? { full_name: profiles[b.assigned_user_id] }
          : undefined,
        client: (b.actual_client_id && clients[b.actual_client_id]) || (b.client_id && clients[b.client_id])
          ? { company_name: clients[b.actual_client_id || b.client_id!] }
          : undefined,
      }));

      hasFetchedRef.current = true;

      setData({
        vehicles,
        bookings: bookingsWithNames,
        repairs,
        financialTransactions: transactions,
        cashRequisitions: crs,
        safariBookings,
        profiles,
        clients,
        loading: false,
        error: null,
      });

      console.log(`[DashboardData #${fetchId}] ========== FETCH COMPLETE ==========`);
    } catch (error) {
      console.error(`[DashboardData #${fetchId}] ========== FETCH ERROR ==========`);
      console.error(`[DashboardData #${fetchId}] Error:`, error);
      if (error instanceof Error) {
        console.error(`[DashboardData #${fetchId}] Error message:`, error.message);
        console.error(`[DashboardData #${fetchId}] Error stack:`, error.stack);
      }
      setData(prev => ({
        ...prev,
        loading: false,
        error: error as Error,
      }));
    }
  }, [
    dashboardMonthFilter,
    dashboardFilterYear,
    fetchVehicles,
    fetchBookings,
    fetchRepairs,
    fetchTransactions,
    fetchCashRequisitions,
    fetchSafariBookings,
    fetchProfiles,
    fetchClients,
  ]);

  // Fetch on mount and when filters change
  useEffect(() => {
    console.log('[DashboardData] useEffect triggered - fetching data...');
    fetchAllData();
  }, [fetchAllData]);

  // Create a stable refetch reference that won't change between renders
  // This prevents infinite re-render loops in useDashboardRealtimeSync
  const refetchRef = useRef(fetchAllData);
  refetchRef.current = fetchAllData;

  const stableRefetch = useCallback(() => {
    console.log('[DashboardData] stableRefetch called');
    return refetchRef.current();
  }, []);

  return {
    ...data,
    refetch: stableRefetch,
  };
}
