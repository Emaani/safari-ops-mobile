import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Booking, BookingStatus } from '../types/dashboard';

interface BookingsDataState {
  bookings: Booking[];
  profiles: Record<string, string>;
  clients: Record<string, string>;
  loading: boolean;
  error: Error | null;
}

interface UseBookingsDataProps {
  statusFilter?: BookingStatus | 'all';
}

// Generate a unique fetch ID for debugging
let fetchCounter = 0;

export function useBookingsData({ statusFilter = 'all' }: UseBookingsDataProps = {}) {
  const [data, setData] = useState<BookingsDataState>({
    bookings: [],
    profiles: {},
    clients: {},
    loading: true,
    error: null,
  });

  // Track if initial fetch has been done
  const hasFetchedRef = useRef(false);

  // Fetch Bookings
  const fetchBookings = useCallback(async (fetchId: number) => {
    console.log(`[BookingsData #${fetchId}] Fetching bookings...`);

    let query = supabase
      .from('bookings')
      .select(
        'id, booking_reference, start_date, end_date, status, amount_paid, total_amount, currency, assigned_vehicle_id, assigned_to, client_id, client_name, contact, email, notes'
      )
      .order('start_date', { ascending: false });

    // Apply status filter if not 'all'
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data: bookings, error } = await query;

    if (error) {
      console.error(`[BookingsData #${fetchId}] ERROR fetching bookings:`, error.message, error.details, error.hint);
      throw error;
    }

    // Map database columns to app interface with aliases for backwards compatibility
    const result = (bookings || []).map(b => ({
      ...b,
      booking_number: b.booking_reference, // Alias for backwards compatibility
      total_cost: b.total_amount, // Alias for backwards compatibility
    })) as Booking[];

    console.log(`[BookingsData #${fetchId}] Fetched ${result.length} bookings`);

    if (result.length > 0) {
      // Log booking statuses breakdown
      const statusBreakdown = result.reduce((acc, b) => {
        acc[b.status] = (acc[b.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`[BookingsData #${fetchId}] Booking statuses:`, statusBreakdown);
    }

    return result;
  }, [statusFilter]);

  // Fetch Profiles
  const fetchProfiles = useCallback(async (fetchId: number) => {
    console.log(`[BookingsData #${fetchId}] Fetching profiles...`);
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name');

    if (error) {
      console.error(`[BookingsData #${fetchId}] ERROR fetching profiles:`, error.message);
      throw error;
    }

    const profileMap: Record<string, string> = {};
    (profiles || []).forEach((p: any) => {
      profileMap[p.id] = p.full_name;
    });

    console.log(`[BookingsData #${fetchId}] Fetched ${Object.keys(profileMap).length} profiles`);
    return profileMap;
  }, []);

  // Fetch Clients
  const fetchClients = useCallback(async (fetchId: number) => {
    console.log(`[BookingsData #${fetchId}] Fetching clients...`);
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, company_name');

    if (error) {
      console.error(`[BookingsData #${fetchId}] ERROR fetching clients:`, error.message);
      throw error;
    }

    const clientMap: Record<string, string> = {};
    (clients || []).forEach((c: any) => {
      clientMap[c.id] = c.company_name;
    });

    console.log(`[BookingsData #${fetchId}] Fetched ${Object.keys(clientMap).length} clients`);
    return clientMap;
  }, []);

  // Fetch Vehicles for vehicle names
  const fetchVehicles = useCallback(async (fetchId: number) => {
    console.log(`[BookingsData #${fetchId}] Fetching vehicles for booking info...`);
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('id, license_plate, make, model');

    if (error) {
      console.error(`[BookingsData #${fetchId}] ERROR fetching vehicles:`, error.message);
      throw error;
    }

    const vehicleMap: Record<string, string> = {};
    (vehicles || []).forEach((v: any) => {
      vehicleMap[v.id] = `${v.license_plate} - ${v.make} ${v.model}`;
    });

    console.log(`[BookingsData #${fetchId}] Fetched ${Object.keys(vehicleMap).length} vehicles`);
    return vehicleMap;
  }, []);

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    const fetchId = ++fetchCounter;

    console.log(`[BookingsData #${fetchId}] ========== FETCH START ==========`);

    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      console.log(`[BookingsData #${fetchId}] Starting parallel fetches...`);
      const startTime = Date.now();

      const [bookings, profiles, clients, vehicles] = await Promise.all([
        fetchBookings(fetchId),
        fetchProfiles(fetchId),
        fetchClients(fetchId),
        fetchVehicles(fetchId),
      ]);

      const fetchDuration = Date.now() - startTime;
      console.log(`[BookingsData #${fetchId}] All fetches completed in ${fetchDuration}ms`);

      // Map client and profile names to bookings
      const bookingsWithNames = bookings.map(b => ({
        ...b,
        profiles: b.assigned_user_id && profiles[b.assigned_user_id]
          ? { full_name: profiles[b.assigned_user_id] }
          : undefined,
        client: (b.actual_client_id && clients[b.actual_client_id]) || (b.client_id && clients[b.client_id!])
          ? { company_name: clients[b.actual_client_id || b.client_id!] }
          : undefined,
        vehicle: b.assigned_vehicle_id && vehicles[b.assigned_vehicle_id]
          ? { name: vehicles[b.assigned_vehicle_id] }
          : undefined,
      }));

      console.log(`[BookingsData #${fetchId}] ========== FETCH SUMMARY ==========`);
      console.log(`[BookingsData #${fetchId}] Bookings: ${bookings.length}`);
      console.log(`[BookingsData #${fetchId}] Profiles: ${Object.keys(profiles).length}`);
      console.log(`[BookingsData #${fetchId}] Clients: ${Object.keys(clients).length}`);

      hasFetchedRef.current = true;

      setData({
        bookings: bookingsWithNames,
        profiles,
        clients,
        loading: false,
        error: null,
      });

      console.log(`[BookingsData #${fetchId}] ========== FETCH COMPLETE ==========`);
    } catch (error) {
      console.error(`[BookingsData #${fetchId}] ========== FETCH ERROR ==========`);
      console.error(`[BookingsData #${fetchId}] Error:`, error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error as Error,
      }));
    }
  }, [fetchBookings, fetchProfiles, fetchClients, fetchVehicles]);

  // Fetch on mount and when filter changes
  useEffect(() => {
    console.log('[BookingsData] useEffect triggered - fetching data...');
    fetchAllData();
  }, [fetchAllData]);

  // Create a stable refetch reference
  const refetchRef = useRef(fetchAllData);
  refetchRef.current = fetchAllData;

  const stableRefetch = useCallback(() => {
    console.log('[BookingsData] stableRefetch called');
    return refetchRef.current();
  }, []);

  return {
    ...data,
    refetch: stableRefetch,
  };
}
