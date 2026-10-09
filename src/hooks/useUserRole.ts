/**
 * useUserRole
 *
 * Reads the signed-in user's role from the `user_roles` table — never from local
 * storage or the Supabase Auth JWT — so permission checks (e.g. payment reversal)
 * match the web dashboard exactly.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { devLog } from '../lib/devLog';

// admin/fleet_manager is the one elevated-permission set this app checks
// client-side (to show/hide an action) — payment reversal, CR approve/decline,
// and CR cancel-on-behalf-of-requester all gate on the exact same roles. The
// server RPC is still the actual enforcement in every case; this only drives
// whether the button is shown.
const ELEVATED_ROLES = ['admin', 'fleet_manager'];

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setRole(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) devLog('[useUserRole] fetch error:', error.message);
        setRole((data?.role as string) ?? null);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user?.id]);

  const isAdminOrFleetManager = !!role && ELEVATED_ROLES.includes(role);

  return {
    role,
    loading,
    isAdminOrFleetManager,
    /** @deprecated use isAdminOrFleetManager — kept so existing call sites don't break */
    canReversePayments: isAdminOrFleetManager,
  };
}
