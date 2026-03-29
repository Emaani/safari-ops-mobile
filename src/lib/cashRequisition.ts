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
    requested_by: pickFirstString(record.requested_by, record.requestor, record.requestedBy),
  };
}
