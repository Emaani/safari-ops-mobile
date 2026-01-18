/**
 * useDashboard Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { JackalSDK } from '../core/JackalSDK';
import { DashboardService } from '../data/DashboardService';
import type { DashboardData, DashboardFilter } from '../data/DashboardService';

export function useDashboard(filter?: DashboardFilter) {
  const sdk = JackalSDK.getInstance();
  const dashboardService = new DashboardService(sdk.api, sdk.logger);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const dashboardData = await dashboardService.getDashboardData(filter);
      setData(dashboardData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
  };
}
