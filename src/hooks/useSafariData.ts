import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Booking } from '../types/dashboard';

interface SafariDataState {
  safaris: Booking[];
  loading: boolean;
  error: Error | null;
}

// Extended Booking type for Safari
export interface Safari extends Booking {
  destination?: string;
  pax_count?: number;
  vehicle?: { name: string };
}

// Generate a unique fetch ID for debugging
let fetchCounter = 0;

export function useSafariData() {
  const [data, setData] = useState<SafariDataState>({
    safaris: [],
    loading: true,
    error: null,
  });

  // Track if initial fetch has been done
  const hasFetchedRef = useRef(false);

  // Fetch Safari Bookings (bookings with safari-related data)
  const fetchSafaris = useCallback(async (fetchId: number) => {
    console.log(`[SafariData #${fetchId}] Fetching safari bookings...`);

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(
        'id, booking_reference, start_date, end_date, status, amount_paid, total_amount, currency, assigned_vehicle_id, assigned_to, client_id, client_name, contact, email, notes'
      )
      .in('status', ['Confirmed', 'In-Progress', 'Completed'])
      .order('start_date', { ascending: false });

    if (error) {
      console.error(`[SafariData #${fetchId}] ERROR fetching safaris:`, error.message);
      throw error;
    }

    // Map database columns to app interface with aliases for backwards compatibility
    const result = (bookings || []).map(b => ({
      ...b,
      booking_number: b.booking_reference, // Alias for backwards compatibility
      total_cost: b.total_amount, // Alias for backwards compatibility
    })) as Booking[];

    console.log(`[SafariData #${fetchId}] Fetched ${result.length} safari bookings`);

    return result;
  }, []);

  // Fetch Clients
  const fetchClients = useCallback(async (fetchId: number) => {
    console.log(`[SafariData #${fetchId}] Fetching clients...`);
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, company_name');

    if (error) {
      console.error(`[SafariData #${fetchId}] ERROR fetching clients:`, error.message);
      throw error;
    }

    const clientMap: Record<string, string> = {};
    (clients || []).forEach((c: any) => {
      clientMap[c.id] = c.company_name;
    });

    return clientMap;
  }, []);

  // Fetch Vehicles
  const fetchVehicles = useCallback(async (fetchId: number) => {
    console.log(`[SafariData #${fetchId}] Fetching vehicles...`);
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('id, license_plate, make, model');

    if (error) {
      console.error(`[SafariData #${fetchId}] ERROR fetching vehicles:`, error.message);
      throw error;
    }

    const vehicleMap: Record<string, string> = {};
    (vehicles || []).forEach((v: any) => {
      vehicleMap[v.id] = `${v.license_plate} - ${v.make} ${v.model}`;
    });

    return vehicleMap;
  }, []);

  // Fetch Profiles
  const fetchProfiles = useCallback(async (fetchId: number) => {
    console.log(`[SafariData #${fetchId}] Fetching profiles...`);
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name');

    if (error) {
      console.error(`[SafariData #${fetchId}] ERROR fetching profiles:`, error.message);
      throw error;
    }

    const profileMap: Record<string, string> = {};
    (profiles || []).forEach((p: any) => {
      profileMap[p.id] = p.full_name;
    });

    return profileMap;
  }, []);

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    const fetchId = ++fetchCounter;

    console.log(`[SafariData #${fetchId}] ========== FETCH START ==========`);

    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      console.log(`[SafariData #${fetchId}] Starting parallel fetches...`);
      const startTime = Date.now();

      const [safaris, clients, vehicles, profiles] = await Promise.all([
        fetchSafaris(fetchId),
        fetchClients(fetchId),
        fetchVehicles(fetchId),
        fetchProfiles(fetchId),
      ]);

      const fetchDuration = Date.now() - startTime;
      console.log(`[SafariData #${fetchId}] All fetches completed in ${fetchDuration}ms`);

      // Map client, vehicle, and profile names to safaris
      const safarisWithNames = safaris.map(s => ({
        ...s,
        client: (s.actual_client_id && clients[s.actual_client_id]) || (s.client_id && clients[s.client_id!])
          ? { company_name: clients[s.actual_client_id || s.client_id!] }
          : undefined,
        vehicle: s.assigned_vehicle_id && vehicles[s.assigned_vehicle_id]
          ? { name: vehicles[s.assigned_vehicle_id] }
          : undefined,
        profiles: s.assigned_user_id && profiles[s.assigned_user_id]
          ? { full_name: profiles[s.assigned_user_id] }
          : undefined,
      }));

      console.log(`[SafariData #${fetchId}] ========== FETCH SUMMARY ==========`);
      console.log(`[SafariData #${fetchId}] Safaris: ${safaris.length}`);

      hasFetchedRef.current = true;

      setData({
        safaris: safarisWithNames,
        loading: false,
        error: null,
      });

      console.log(`[SafariData #${fetchId}] ========== FETCH COMPLETE ==========`);
    } catch (error) {
      console.error(`[SafariData #${fetchId}] ========== FETCH ERROR ==========`);
      console.error(`[SafariData #${fetchId}] Error:`, error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error as Error,
      }));
    }
  }, [fetchSafaris, fetchClients, fetchVehicles, fetchProfiles]);

  // Fetch on mount
  useEffect(() => {
    console.log('[SafariData] useEffect triggered - fetching data...');
    fetchAllData();
  }, [fetchAllData]);

  // Create a stable refetch reference
  const refetchRef = useRef(fetchAllData);
  refetchRef.current = fetchAllData;

  const stableRefetch = useCallback(() => {
    console.log('[SafariData] stableRefetch called');
    return refetchRef.current();
  }, []);

  // Compute categorized safaris
  const categorizedSafaris = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const weekFromNowStr = weekFromNow.toISOString().split('T')[0];

    const monthFromNow = new Date(today);
    monthFromNow.setDate(monthFromNow.getDate() + 30);
    const monthFromNowStr = monthFromNow.toISOString().split('T')[0];

    const activeToday = data.safaris.filter(s => {
      const startDate = s.start_date?.split('T')[0];
      const endDate = s.end_date?.split('T')[0];
      return (s.status === 'In-Progress') ||
             (startDate && startDate <= todayStr && endDate && endDate >= todayStr);
    });

    const upcomingThisWeek = data.safaris.filter(s => {
      const startDate = s.start_date?.split('T')[0];
      return s.status === 'Confirmed' &&
             startDate && startDate > todayStr && startDate <= weekFromNowStr;
    });

    const upcomingThisMonth = data.safaris.filter(s => {
      const startDate = s.start_date?.split('T')[0];
      return s.status === 'Confirmed' &&
             startDate && startDate > weekFromNowStr && startDate <= monthFromNowStr;
    });

    const completed = data.safaris.filter(s => s.status === 'Completed');

    // Get current month completions
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const completedThisMonth = completed.filter(s => {
      const endDate = new Date(s.end_date);
      return endDate.getMonth() === currentMonth && endDate.getFullYear() === currentYear;
    });

    console.log('[SafariData] Categorized safaris:', {
      activeToday: activeToday.length,
      upcomingThisWeek: upcomingThisWeek.length,
      upcomingThisMonth: upcomingThisMonth.length,
      completedThisMonth: completedThisMonth.length,
    });

    return {
      activeToday,
      upcomingThisWeek,
      upcomingThisMonth,
      completed,
      completedThisMonth,
    };
  }, [data.safaris]);

  return {
    ...data,
    ...categorizedSafaris,
    refetch: stableRefetch,
  };
}
