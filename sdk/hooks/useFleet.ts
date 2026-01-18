/**
 * useFleet Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { JackalSDK } from '../core/JackalSDK';
import { FleetService } from '../data/FleetService';
import type { Vehicle, FleetStatus } from '../data/FleetService';

export function useFleet() {
  const sdk = JackalSDK.getInstance();
  const fleetService = new FleetService(sdk.api, sdk.logger);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [status, setStatus] = useState<FleetStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchFleet = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [vehiclesData, statusData] = await Promise.all([
        fleetService.getVehicles(),
        fleetService.getFleetStatus(),
      ]);

      setVehicles(vehiclesData);
      setStatus(statusData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFleet();
  }, [fetchFleet]);

  const updateVehicle = useCallback(async (id: string, data: Partial<Vehicle>) => {
    const updated = await fleetService.updateVehicle(id, data);
    setVehicles((prev) => prev.map((v) => (v.id === id ? updated : v)));
    await fetchFleet(); // Refresh status
    return updated;
  }, [fetchFleet]);

  return {
    vehicles,
    status,
    loading,
    error,
    refetch: fetchFleet,
    updateVehicle,
  };
}
