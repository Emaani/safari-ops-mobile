/**
 * FleetDataContext
 *
 * Found in the Oct 2026 sync & robustness audit (follow-up pass): useFleetData()
 * was being instantiated independently in both FleetScreen and BookingsScreen —
 * both tabs stay mounted simultaneously under the bottom tab navigator, so this
 * ran two separate `vehicles`/`repairs` fetches on every mount, and only
 * FleetScreen's instance was wired to useFleetRealtimeSync — BookingsScreen's
 * copy of the vehicle list went stale after any vehicle status change until
 * that screen happened to remount. Exact same bug class as useNotifications
 * and useExchangeRate before this.
 *
 * This provider runs useFleetData + useFleetRealtimeSync exactly once and
 * shares the result, so there is one fetch, one realtime subscription, and
 * every consumer sees live updates.
 */

import React, { createContext, useContext } from 'react';
import { useFleetData } from '../hooks/useFleetData';
import { useFleetRealtimeSync } from '../hooks/useFleetRealtimeSync';

type FleetDataContextValue = ReturnType<typeof useFleetData>;

const FleetDataContext = createContext<FleetDataContextValue | null>(null);

export function FleetDataProvider({ children }: { children: React.ReactNode }) {
  const value = useFleetData();
  useFleetRealtimeSync(value.refetch);

  return (
    <FleetDataContext.Provider value={value}>
      {children}
    </FleetDataContext.Provider>
  );
}

/** Must be called under FleetDataProvider — throws otherwise so a missing provider fails loudly. */
export function useFleetDataContext(): FleetDataContextValue {
  const ctx = useContext(FleetDataContext);
  if (!ctx) throw new Error('useFleetDataContext must be used within a FleetDataProvider');
  return ctx;
}
