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
import { logEvent } from '../lib/eventLogger';

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

    const fetchRole = () => {
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
    };

    fetchRole();

    // Admins can change a user's role from the web dashboard while this app
    // is open (e.g. revoking fleet_manager). Without this subscription the
    // already-mounted session keeps the stale role — and the elevated-action
    // buttons it unlocks — until the user restarts or re-logs in. Filtered to
    // this user's own row so a role change made anywhere is picked up live.
    const channel = supabase
      .channel(`user-role-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${user.id}` },
        () => {
          devLog('[useUserRole] role change detected, refetching');
          fetchRole();
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[useUserRole] realtime channel error:', err);
          logEvent('realtime_channel_error', err?.message || 'user_roles channel error', { table: 'user_roles' }, 'warning');
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
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
