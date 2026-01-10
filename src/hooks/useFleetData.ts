import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Vehicle, Repair } from '../types/dashboard';

interface FleetDataState {
  vehicles: Vehicle[];
  repairs: Repair[];
  loading: boolean;
  error: Error | null;
}

// Generate a unique fetch ID for debugging
let fetchCounter = 0;

export function useFleetData() {
  const [data, setData] = useState<FleetDataState>({
    vehicles: [],
    repairs: [],
    loading: true,
    error: null,
  });

  // Track if initial fetch has been done
  const hasFetchedRef = useRef(false);

  // Fetch Vehicles
  const fetchVehicles = useCallback(async (fetchId: number) => {
    console.log(`[FleetData #${fetchId}] Fetching vehicles...`);
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('id, license_plate, make, model, capacity, status, rating, current_driver_id, year, odometer, daily_rate_usd, daily_rate_ugx, fuel_type, color, insurance_expiry, last_service_date, next_service_date, drivers(full_name)')
      .order('license_plate', { ascending: true });

    if (error) {
      console.error(`[FleetData #${fetchId}] ERROR fetching vehicles:`, error.message, error.details, error.hint);
      throw error;
    }

    const result = (vehicles || []).map(v => ({
      ...v,
      drivers: v.drivers && Array.isArray(v.drivers) && v.drivers.length > 0
        ? { full_name: v.drivers[0].full_name }
        : undefined,
    })) as Vehicle[];

    console.log(`[FleetData #${fetchId}] Fetched ${result.length} vehicles`);
    if (result.length > 0) {
      console.log(`[FleetData #${fetchId}] Vehicle statuses:`, result.map(v => v.status).reduce((acc, s) => {
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {} as Record<string, number>));
    }

    return result;
  }, []);

  // Fetch Repairs (active only)
  const fetchRepairs = useCallback(async (fetchId: number) => {
    console.log(`[FleetData #${fetchId}] Fetching repairs...`);
    const { data: repairs, error } = await supabase
      .from('repairs')
      .select('id, vehicle_id, description, status, priority, reported_at, estimated_cost, vehicles(license_plate)')
      .in('status', ['open', 'in_progress'])
      .order('priority', { ascending: false })
      .order('reported_at', { ascending: false });

    if (error) {
      console.error(`[FleetData #${fetchId}] ERROR fetching repairs:`, error.message, error.details, error.hint);
      throw error;
    }

    const result = (repairs || []).map(r => ({
      ...r,
      vehicles: r.vehicles && Array.isArray(r.vehicles) && r.vehicles.length > 0
        ? { license_plate: r.vehicles[0].license_plate }
        : undefined,
    })) as Repair[];
    console.log(`[FleetData #${fetchId}] Fetched ${result.length} active repairs`);
    return result;
  }, []);

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    const fetchId = ++fetchCounter;

    console.log(`[FleetData #${fetchId}] ========== FETCH START ==========`);

    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      console.log(`[FleetData #${fetchId}] Starting parallel fetches...`);
      const startTime = Date.now();

      const [vehicles, repairs] = await Promise.all([
        fetchVehicles(fetchId),
        fetchRepairs(fetchId),
      ]);

      const fetchDuration = Date.now() - startTime;
      console.log(`[FleetData #${fetchId}] All fetches completed in ${fetchDuration}ms`);

      console.log(`[FleetData #${fetchId}] ========== FETCH SUMMARY ==========`);
      console.log(`[FleetData #${fetchId}] Vehicles: ${vehicles.length}`);
      console.log(`[FleetData #${fetchId}] Repairs: ${repairs.length}`);

      hasFetchedRef.current = true;

      setData({
        vehicles,
        repairs,
        loading: false,
        error: null,
      });

      console.log(`[FleetData #${fetchId}] ========== FETCH COMPLETE ==========`);
    } catch (error) {
      console.error(`[FleetData #${fetchId}] ========== FETCH ERROR ==========`);
      console.error(`[FleetData #${fetchId}] Error:`, error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error as Error,
      }));
    }
  }, [fetchVehicles, fetchRepairs]);

  // Fetch on mount
  useEffect(() => {
    console.log('[FleetData] useEffect triggered - fetching data...');
    fetchAllData();
  }, [fetchAllData]);

  // Create a stable refetch reference
  const refetchRef = useRef(fetchAllData);
  refetchRef.current = fetchAllData;

  const stableRefetch = useCallback(() => {
    console.log('[FleetData] stableRefetch called');
    return refetchRef.current();
  }, []);

  return {
    ...data,
    refetch: stableRefetch,
  };
}
