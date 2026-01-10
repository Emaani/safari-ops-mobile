import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Currency } from '../types/dashboard';

interface DashboardMetricsRPC {
  total_revenue: number;
  total_expenses: number;
  active_bookings: number;
  fleet_utilization: number;
  outstanding_payments: number;
  revenue_mtd: number;
  revenue_ytd: number;
  total_fleet: number;
  vehicles_hired: number;
  currency: Currency;
  filter_month: number | null;
  filter_year: number;
  calculated_at: string;
}

interface UseDashboardMetricsRPCProps {
  filterMonth: number | null;
  filterYear: number;
  displayCurrency: Currency;
}

export function useDashboardMetricsRPC({
  filterMonth,
  filterYear,
  displayCurrency,
}: UseDashboardMetricsRPCProps) {
  const [metrics, setMetrics] = useState<DashboardMetricsRPC | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[DashboardMetricsRPC] Fetching metrics via RPC...', {
        filterMonth,
        filterYear,
        displayCurrency,
      });

      const { data, error: rpcError } = await supabase.rpc('get_dashboard_metrics', {
        filter_month: filterMonth,
        filter_year: filterYear,
        display_currency: displayCurrency,
      });

      if (rpcError) {
        console.error('[DashboardMetricsRPC] RPC Error:', rpcError);
        throw rpcError;
      }

      console.log('[DashboardMetricsRPC] Metrics received:', data);
      setMetrics(data as DashboardMetricsRPC);
    } catch (err) {
      console.error('[DashboardMetricsRPC] Fetch error:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear, displayCurrency]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics,
  };
}
