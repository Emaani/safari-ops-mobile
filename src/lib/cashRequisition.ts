import type { CashRequisition, Currency } from '../types/dashboard';

function pickFirstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

function toCurrency(value: unknown): Currency {
  return value === 'UGX' || value === 'KES' ? value : 'USD';
}

export function normalizeCashRequisition(record: Record<string, unknown>): CashRequisition {
  // Handle nested approver join from Supabase (profiles table)
  const approverRaw = record.approver as Record<string, unknown> | null | undefined;
  const approver = approverRaw
    ? {
        full_name: typeof approverRaw.full_name === 'string' ? approverRaw.full_name : null,
        email:     typeof approverRaw.email === 'string' ? approverRaw.email : null,
      }
    : null;

  return {
    id: String(record.id ?? ''),
    cr_number: String(record.cr_number ?? record.reference_number ?? ''),
    total_cost: Number(record.total_cost ?? record.amount ?? 0),
    currency: toCurrency(record.currency),
    status: String(record.status ?? 'Pending') as CashRequisition['status'],
    date_needed: String(record.date_needed ?? record.created_at ?? new Date().toISOString()),
    expense_category: String(record.expense_category ?? record.category ?? 'Uncategorized'),
    date_completed:
      typeof record.date_completed === 'string' ? record.date_completed : undefined,
    created_at: String(record.created_at ?? new Date().toISOString()),
    amount_usd:
      typeof record.amount_usd === 'number'
        ? record.amount_usd
        : typeof record.amount_usd === 'string'
          ? Number(record.amount_usd)
          : undefined,
    description: pickFirstString(
      record.description,
      record.purpose,
      record.notes,
      record.details,
      record.reason
    ),
    requester_id:    typeof record.requester_id === 'string' ? record.requester_id : null,
    purpose:         typeof record.purpose === 'string' ? record.purpose : undefined,
    department:      typeof record.department === 'string' ? record.department : undefined,
    payment_mode:    typeof record.payment_mode === 'string' ? record.payment_mode : undefined,
    payee_name:      typeof record.payee_name === 'string' ? record.payee_name : undefined,
    requested_by:    pickFirstString(record.requested_by, record.requestor, record.requestedBy),
    requester_name:  pickFirstString(record.requester_name, record.requested_by, record.requestor),
    requester_email: typeof record.requester_email === 'string' ? record.requester_email : undefined,
    approver_id:  typeof record.approver_id === 'string' ? record.approver_id : null,
    approved_at:  typeof record.approved_at === 'string' ? record.approved_at : null,
    declined_at:  typeof record.declined_at === 'string' ? record.declined_at : null,
    approver,
  };
}
