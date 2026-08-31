import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Vehicle,
  Booking,
  Repair,
  FinancialTransaction,
  CashRequisition,
  SafariBooking,
} from '../types/dashboard';

interface DashboardDataState {
  vehicles: Vehicle[];
  bookings: Booking[];
  recentBookings: Booking[]; // unfiltered — top 10 by created_at DESC for the Recent Bookings widget
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
    recentBookings: [],
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
  const fetchVehicles = useCallback(async (_fetchId: number) => {
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('id, license_plate, make, model, capacity, status, rating, current_driver_id, drivers(full_name)')
      .order('license_plate', { ascending: true });

    if (error) throw error;

    return (vehicles || []).map(v => ({
      ...v,
      drivers: v.drivers && Array.isArray(v.drivers) && v.drivers.length > 0
        ? { full_name: v.drivers[0].full_name }
        : undefined,
    })) as Vehicle[];
  }, []);

  // Fetch Bookings — always full calendar year so the monthly chart has all 12 months.
  // Client-side filtering in useDashboardCalculations scopes KPIs to the selected month.
  const fetchBookings = useCallback(async (_fetchId: number) => {
    const year = dashboardFilterYear;
    const firstDay = `${year}-01-01`;
    const lastDay  = `${year}-12-31`;

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(
        'id, booking_reference, start_date, end_date, status, amount_paid, total_amount, balance_due, currency, assigned_vehicle_id, assigned_to, client_id, client_name, created_at, is_vendor_vehicle'
      )
      .order('start_date', { ascending: false })
      .gte('start_date', firstDay)
      .lte('start_date', lastDay);

    if (error) throw error;

    return (bookings || []).map(b => ({
      ...b,
      booking_number: b.booking_reference,
      total_cost: b.total_amount,
    })) as Booking[];
  }, [dashboardFilterYear]);

  // Fetch Repairs (active only)
  const fetchRepairs = useCallback(async (_fetchId: number) => {
    const { data: repairs, error } = await supabase
      .from('repairs')
      .select('id, vehicle_id, description, status, priority, reported_at, estimated_cost, vehicles(license_plate)')
      .in('status', ['open', 'in_progress'])
      .order('priority', { ascending: false })
      .order('reported_at', { ascending: false });

    if (error) throw error;

    return (repairs || []).map(r => ({
      ...r,
      vehicles: r.vehicles && Array.isArray(r.vehicles) && r.vehicles.length > 0
        ? { license_plate: r.vehicles[0].license_plate }
        : undefined,
    })) as Repair[];
  }, []);

  // Fetch Financial Transactions — full calendar year so the monthly chart has all 12 months.
  const fetchTransactions = useCallback(async (_fetchId: number) => {
    const year = dashboardFilterYear;
    const { data: transactions, error } = await supabase
      .from('financial_transactions')
      .select('id, transaction_date, amount, transaction_type, category, currency, description, reference_number, status')
      .neq('status', 'cancelled')
      .order('transaction_date', { ascending: true })
      .gte('transaction_date', `${year}-01-01`)
      .lte('transaction_date', `${year}-12-31`);

    if (error) throw error;
    return (transactions || []) as FinancialTransaction[];
  }, [dashboardFilterYear]);

  // Fetch Cash Requisitions — full calendar year so the monthly chart has all 12 months.
  const fetchCashRequisitions = useCallback(async (_fetchId: number) => {
    const year = dashboardFilterYear;
    const { data: crs, error } = await supabase
      .from('cash_requisitions')
      .select('id, cr_number, total_cost, currency, status, date_needed, expense_category, date_completed, created_at, amount_usd')
      .eq('soft_deleted', false)
      .not('status', 'in', '(Declined,Rejected)')
      .order('created_at', { ascending: true })
      .gte('created_at', `${year}-01-01`)
      .lte('created_at', `${year}-12-31`);

    if (error) throw error;
    return (crs || []) as CashRequisition[];
  }, [dashboardFilterYear]);

  // Fetch Profiles (for assigned user names)
  const fetchProfiles = useCallback(async (_fetchId: number) => {
    const { data: profiles, error } = await supabase.from('profiles').select('id, full_name');
    if (error) throw error;
    const profileMap: Record<string, string> = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p.full_name; });
    return profileMap;
  }, []);

  // Fetch Clients (for company names)
  const fetchClients = useCallback(async (_fetchId: number) => {
    const { data: clients, error } = await supabase.from('clients').select('id, company_name');
    if (error) throw error;
    const clientMap: Record<string, string> = {};
    (clients || []).forEach(c => { clientMap[c.id] = c.company_name; });
    return clientMap;
  }, []);

  // Fetch Safari Bookings — full calendar year so the monthly chart has all 12 months.
  const fetchSafariBookings = useCallback(async (_fetchId: number) => {
    const year = dashboardFilterYear;
    const { data: safariBookings, error } = await supabase
      .from('safari_bookings')
      .select('id, total_price_usd, total_price_ugx, total_expenses_usd, total_expenses_ugx, vehicle_hire_cost_usd, vehicle_hire_cost_ugx, start_date, end_date, amount_paid, currency')
      .order('start_date', { ascending: false })
      .gte('start_date', `${year}-01-01`)
      .lte('start_date', `${year}-12-31`);

    if (error) {
      console.warn('[DashboardData] safari_bookings not available:', error.message);
      return [] as SafariBooking[];
    }
    return (safariBookings || []) as SafariBooking[];
  }, [dashboardFilterYear]);

  // Fetch Recent Bookings — NOT date-filtered, always top 10 by created_at DESC
  // This mirrors the web dashboard which shows the 10 most recently created bookings
  // regardless of the current year/month filter.
  const fetchRecentBookings = useCallback(async (_fetchId: number) => {
    const { data: rows, error } = await supabase
      .from('bookings')
      .select('id, booking_reference, start_date, end_date, status, amount_paid, total_amount, balance_due, currency, assigned_vehicle_id, client_id, client_name, created_at')
      .in('status', ['In-Progress', 'Pending'])
      .order('start_date', { ascending: true })
      .limit(10);

    if (error) return [] as Booking[];

    return (rows || []).map(b => ({
      ...b,
      booking_number: b.booking_reference,
      total_cost: b.total_amount,
    })) as Booking[];
  }, []);

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    const fetchId = ++fetchCounter;
    lastFilterRef.current = { month: dashboardMonthFilter, year: dashboardFilterYear };

    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      const [
        vehicles,
        bookings,
        recentBookings,
        repairs,
        transactions,
        crs,
        safariBookings,
        profiles,
        clients,
      ] = await Promise.all([
        fetchVehicles(fetchId),
        fetchBookings(fetchId),
        fetchRecentBookings(fetchId),
        fetchRepairs(fetchId),
        fetchTransactions(fetchId),
        fetchCashRequisitions(fetchId),
        fetchSafariBookings(fetchId),
        fetchProfiles(fetchId),
        fetchClients(fetchId),
      ]);

      // Map assigned user names to bookings
      const bookingsWithNames = bookings.map(b => ({
        ...b,
        profiles: (b.assigned_to || b.assigned_user_id) && profiles[b.assigned_to || b.assigned_user_id!]
          ? { full_name: profiles[b.assigned_to || b.assigned_user_id!] }
          : undefined,
        client: (b.actual_client_id && clients[b.actual_client_id]) || (b.client_id && clients[b.client_id])
          ? { company_name: clients[b.actual_client_id || b.client_id!] }
          : undefined,
      }));

      hasFetchedRef.current = true;

      setData({
        vehicles,
        bookings: bookingsWithNames,
        recentBookings,
        repairs,
        financialTransactions: transactions,
        cashRequisitions: crs,
        safariBookings,
        profiles,
        clients,
        loading: false,
        error: null,
      });

    } catch (error) {
      console.error('[DashboardData] Fetch error:', error instanceof Error ? error.message : error);
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
    fetchRecentBookings,
    fetchRepairs,
    fetchTransactions,
    fetchCashRequisitions,
    fetchSafariBookings,
    fetchProfiles,
    fetchClients,
  ]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // Create a stable refetch reference that won't change between renders
  // This prevents infinite re-render loops in useDashboardRealtimeSync
  const refetchRef = useRef(fetchAllData);
  refetchRef.current = fetchAllData;

  const stableRefetch = useCallback(() => refetchRef.current(), []);

  return {
    ...data,
    refetch: stableRefetch,
  };
}
