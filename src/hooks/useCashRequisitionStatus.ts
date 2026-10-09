/**
 * useCashRequisitionStatus
 *
 * Approve/Decline/Cancel all go through the shared `update_cr_status` RPC —
 * server-side rules: Admin/fleet_manager for approve/decline, requester or
 * admin for cancel, decline requires a reason, and a finished CR cannot
 * change status again. The CR → financial_transactions ledger row is created
 * entirely server-side by a trigger on Approved/Resolved — mobile must never
 * insert into financial_transactions itself.
 */

import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { devError } from '../lib/devLog';
import { getErrorMessage } from '../lib/errors';

export type CrStatusAction = 'Approved' | 'Declined' | 'Cancelled';

interface UpdateCrStatusResult {
  ok: boolean;
  status?: string;
  error?: string;
  /** True when the server reports the CR was already in this finished state —
   *  treat as a soft-success when replaying from the offline queue. */
  alreadyFinished?: boolean;
}

export function useCashRequisitionStatus() {
  const [updating, setUpdating] = useState(false);

  const updateStatus = useCallback(async (
    crId: string,
    newStatus: CrStatusAction,
    opts: { notes?: string | null; reason?: string | null } = {},
  ): Promise<UpdateCrStatusResult> => {
    setUpdating(true);
    try {
      const { data, error } = await supabase.rpc('update_cr_status', {
        p_cr_id: crId,
        p_status: newStatus,
        p_notes: opts.notes ?? null,
        p_reason: opts.reason ?? null,
      });

      if (error) {
        devError('[CashRequisitionStatus] update_cr_status error:', error.message);
        const alreadyFinished = /finished|already|cannot change/i.test(error.message);
        return { ok: false, error: getErrorMessage(error, 'Failed to update requisition status.'), alreadyFinished };
      }

      const row = Array.isArray(data) ? data[0] : data;
      return { ok: true, status: row?.status };
    } catch (e: any) {
      devError('[CashRequisitionStatus] update_cr_status exception:', e);
      return { ok: false, error: getErrorMessage(e, 'Failed to update requisition status.') };
    } finally {
      setUpdating(false);
    }
  }, []);

  return { updateStatus, updating };
}
