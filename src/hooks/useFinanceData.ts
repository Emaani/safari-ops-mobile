import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeCashRequisition } from '../lib/cashRequisition';
import type { FinancialTransaction, CashRequisition, Currency } from '../types/dashboard';

// ─── Unified Revenue Item ─────────────────────────────────────────────────────
// Represents any revenue entry regardless of source table
export interface RevenueItem {
  id: string;
  source: 'booking' | 'safari_booking' | 'transaction';
  date: string;
  amount: number;
  currency: Currency;
  title: string;         // e.g. "Booking REF-001" / "Safari Booking" / category
  subtitle: string;      // description / client / dates
  status: string;
  reference?: string;
}

// ─── Unified Expense Item ─────────────────────────────────────────────────────
export interface ExpenseItem {
  id: string;
  source: 'cash_requisition' | 'transaction';
  date: string;
  amount: number;
  currency: Currency;
  title: string;
  subtitle: string;
  status: string;
  reference?: string;
}

interface FinanceDataState {
  transactions: FinancialTransaction[];
  cashRequisitions: CashRequisition[];
  loading: boolean;
  error: Error | null;
}

interface UseFinanceDataProps {
  currency?: Currency;
}

// Normalise transaction_type from DB — DB may store 'revenue', 'Revenue', 'booking', etc.
function normalizeTransactionType(raw: string | null | undefined): 'income' | 'expense' {
  if (!raw) return 'expense';
  const lower = raw.toLowerCase().trim();
  if (lower === 'income' || lower === 'revenue' || lower === 'booking' || lower === 'inflow') {
    return 'income';
  }
  return 'expense';
}

let fetchCounter = 0;

export function useFinanceData({ currency = 'USD' }: UseFinanceDataProps = {}) {
  const [data, setData] = useState<FinanceDataState>({
    transactions: [],
    cashRequisitions: [],
    loading: true,
    error: null,
  });

  // Raw booking data from DB
  const [rawBookings,       setRawBookings]       = useState<Record<string, unknown>[]>([]);
  const [rawSafariBookings, setRawSafariBookings] = useState<Record<string, unknown>[]>([]);

  const hasFetchedRef = useRef(false);

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchTransactions = useCallback(async (fetchId: number) => {
    console.log(`[FinanceData #${fetchId}] Fetching transactions...`);
    const { data: rows, error } = await supabase
      .from('financial_transactions')
      .select('id, transaction_date, amount, transaction_type, category, currency, description, reference_number, status')
      .neq('status', 'cancelled')
      .order('transaction_date', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Normalise transaction_type so income entries are always classified correctly
    const result = (rows || []).map((t) => ({
      ...t,
      transaction_type: normalizeTransactionType(t.transaction_type as string),
    })) as FinancialTransaction[];

    const typeBreakdown = result.reduce((acc, t) => {
      acc[t.transaction_type] = (acc[t.transaction_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`[FinanceData #${fetchId}] Transactions:`, typeBreakdown);

    return result;
  }, []);

  const fetchCashRequisitions = useCallback(async (fetchId: number) => {
    console.log(`[FinanceData #${fetchId}] Fetching cash requisitions...`);
    const { data: crs, error } = await supabase
      .from('cash_requisitions')
      .select('*')
      .eq('soft_deleted', false)
      .not('status', 'in', '(Declined,Rejected)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const records = (crs || []) as Record<string, unknown>[];
    const approverIds = Array.from(new Set(
      records
        .map((record) => record.approver_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ));

    let approverMap: Record<string, { full_name: string | null; email: string | null }> = {};
    if (approverIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', approverIds);

      if (profilesError) {
        console.warn(`[FinanceData #${fetchId}] Could not hydrate CR approvers:`, profilesError.message);
      } else {
        approverMap = (profiles || []).reduce((acc, profile: any) => {
          acc[profile.id] = {
            full_name: typeof profile.full_name === 'string' ? profile.full_name : null,
            email:     typeof profile.email === 'string' ? profile.email : null,
          };
          return acc;
        }, {} as Record<string, { full_name: string | null; email: string | null }>);
      }
    }

    return records.map((record) => {
      const approverId = typeof record.approver_id === 'string' ? record.approver_id : null;
      return normalizeCashRequisition({
        ...record,
        approver: approverId ? approverMap[approverId] ?? null : null,
      });
    }) as CashRequisition[];
  }, []);

  const fetchBookings = useCallback(async (fetchId: number) => {
    console.log(`[FinanceData #${fetchId}] Fetching bookings (revenue)...`);
    const { data: rows, error } = await supabase
      .from('bookings')
      .select('id, booking_reference, start_date, end_date, status, amount_paid, total_amount, currency, client_name, created_at')
      .not('status', 'in', '(Cancelled,cancelled)')
      .order('start_date', { ascending: false })
      .limit(100);

    if (error) {
      console.warn(`[FinanceData #${fetchId}] Could not fetch bookings:`, error.message);
      return [];
    }
    console.log(`[FinanceData #${fetchId}] Fetched ${(rows || []).length} bookings`);
    return (rows || []) as Record<string, unknown>[];
  }, []);

  const fetchSafariBookings = useCallback(async (fetchId: number) => {
    console.log(`[FinanceData #${fetchId}] Fetching safari bookings (revenue)...`);
    const { data: rows, error } = await supabase
      .from('safari_bookings')
      .select('id, total_price_usd, total_price_ugx, start_date, end_date, amount_paid, currency, status')
      .order('start_date', { ascending: false })
      .limit(100);

    if (error) {
      console.warn(`[FinanceData #${fetchId}] Could not fetch safari bookings:`, error.message);
      return [];
    }
    console.log(`[FinanceData #${fetchId}] Fetched ${(rows || []).length} safari bookings`);
    return (rows || []) as Record<string, unknown>[];
  }, []);

  // ── Fetch All ─────────────────────────────────────────────────────────────

  const fetchAllData = useCallback(async () => {
    const fetchId = ++fetchCounter;
    console.log(`[FinanceData #${fetchId}] ===== FETCH START =====`);

    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      const [transactions, cashRequisitions, bookings, safariBookings] = await Promise.all([
        fetchTransactions(fetchId),
        fetchCashRequisitions(fetchId),
        fetchBookings(fetchId),
        fetchSafariBookings(fetchId),
      ]);

      hasFetchedRef.current = true;

      setData({ transactions, cashRequisitions, loading: false, error: null });
      setRawBookings(bookings);
      setRawSafariBookings(safariBookings);

      console.log(`[FinanceData #${fetchId}] ===== FETCH COMPLETE =====`);
    } catch (error) {
      console.error(`[FinanceData #${fetchId}] FETCH ERROR:`, error);
      setData(prev => ({ ...prev, loading: false, error: error as Error }));
    }
  }, [fetchTransactions, fetchCashRequisitions, fetchBookings, fetchSafariBookings]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const refetchRef = useRef(fetchAllData);
  refetchRef.current = fetchAllData;
  const stableRefetch = useCallback(() => refetchRef.current(), []);

  // ── Currency conversion ───────────────────────────────────────────────────

  const convertAmount = useCallback((amount: number, fromCurrency: string): number => {
    const rates: Record<string, number> = { USD: 1, UGX: 3700, KES: 130 };
    const fromRate = rates[fromCurrency] || 1;
    const toRate   = rates[currency] || 1;
    return (amount / fromRate) * toRate;
  }, [currency]);

  // ── Unified Revenue Items ─────────────────────────────────────────────────
  // Sources: bookings (Reservations) + safari_bookings + income financial_transactions

  const revenueItems = useMemo((): RevenueItem[] => {
    const items: RevenueItem[] = [];

    // 1. Vehicle Bookings / Reservations
    rawBookings.forEach((b) => {
      const amount = Number(b.total_amount ?? b.amount_paid ?? 0);
      const cur    = (b.currency as Currency) || 'USD';
      const ref    = (b.booking_reference as string) || (b.id as string).slice(0, 8).toUpperCase();
      const date   = (b.start_date as string) || (b.created_at as string) || '';
      const client = (b.client_name as string) || '';
      const status = (b.status as string) || 'Confirmed';

      items.push({
        id:        `booking-${b.id}`,
        source:    'booking',
        date,
        amount,
        currency:  cur,
        title:     `Booking · ${ref}`,
        subtitle:  client || `${date ? new Date(date).toLocaleDateString() : 'Vehicle booking'}`,
        status,
        reference: ref,
      });
    });

    // 2. Safari Bookings
    rawSafariBookings.forEach((s) => {
      const amountUSD = Number(s.total_price_usd ?? 0);
      const amountUGX = Number(s.total_price_ugx ?? 0);
      const cur       = (s.currency as Currency) || 'USD';
      const amount    = cur === 'UGX' && amountUGX > 0 ? amountUGX : amountUSD;
      const date      = (s.start_date as string) || '';
      const status    = (s.status as string) || 'Active';

      items.push({
        id:       `safari-${s.id}`,
        source:   'safari_booking',
        date,
        amount,
        currency: cur === 'UGX' && amountUGX > 0 ? 'UGX' : 'USD',
        title:    'Safari Booking',
        subtitle: date ? `Safari · ${new Date(date).toLocaleDateString()}` : 'Safari Booking',
        status,
      });
    });

    // 3. Income entries from financial_transactions
    data.transactions
      .filter(t => t.transaction_type === 'income')
      .forEach((t) => {
        items.push({
          id:        `txn-${t.id}`,
          source:    'transaction',
          date:      t.transaction_date,
          amount:    t.amount,
          currency:  t.currency,
          title:     t.category || 'Income',
          subtitle:  t.description || t.reference_number || '',
          status:    t.status,
          reference: t.reference_number,
        });
      });

    // Sort newest first
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [rawBookings, rawSafariBookings, data.transactions]);

  // ── Unified Expense Items ─────────────────────────────────────────────────
  // Sources: cash_requisitions + expense financial_transactions

  const expenseItems = useMemo((): ExpenseItem[] => {
    const items: ExpenseItem[] = [];

    // 1. Cash Requisitions
    data.cashRequisitions.forEach((cr) => {
      items.push({
        id:        `cr-${cr.id}`,
        source:    'cash_requisition',
        date:      cr.date_needed || cr.created_at,
        amount:    cr.total_cost,
        currency:  cr.currency,
        title:     cr.expense_category || 'Cash Requisition',
        subtitle:  cr.cr_number ? `CR ${cr.cr_number}` : (cr.description || ''),
        status:    cr.status,
        reference: cr.cr_number,
      });
    });

    // 2. Expense entries from financial_transactions
    data.transactions
      .filter(t => t.transaction_type === 'expense')
      .forEach((t) => {
        items.push({
          id:        `txn-${t.id}`,
          source:    'transaction',
          date:      t.transaction_date,
          amount:    t.amount,
          currency:  t.currency,
          title:     t.category || 'Expense',
          subtitle:  t.description || t.reference_number || '',
          status:    t.status,
          reference: t.reference_number,
        });
      });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.cashRequisitions, data.transactions]);

  // ── Financial Summary ─────────────────────────────────────────────────────

  const financialSummary = useMemo(() => {
    const now          = new Date();
    const currentMonth = now.getMonth();
    const currentYear  = now.getFullYear();

    const isThisMonth = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    };
    const isThisYear = (dateStr: string) => {
      return new Date(dateStr).getFullYear() === currentYear;
    };

    const sumRevenue = (items: RevenueItem[]) =>
      items.reduce((sum, i) => sum + convertAmount(i.amount, i.currency), 0);
    const sumExpense = (items: ExpenseItem[]) =>
      items.reduce((sum, i) => sum + convertAmount(i.amount, i.currency), 0);

    const revenueMTD   = sumRevenue(revenueItems.filter(i => isThisMonth(i.date)));
    const revenueYTD   = sumRevenue(revenueItems.filter(i => isThisYear(i.date)));
    const expensesMTD  = sumExpense(expenseItems.filter(i => isThisMonth(i.date)));
    const expensesYTD  = sumExpense(expenseItems.filter(i => isThisYear(i.date)));
    const netProfitMTD = revenueMTD - expensesMTD;
    const netProfitYTD = revenueYTD - expensesYTD;

    const pendingCRs   = data.cashRequisitions.filter(cr => cr.status === 'Pending' || cr.status === 'Approved');
    const completedCRs = data.cashRequisitions.filter(cr => cr.status === 'Completed' || cr.status === 'Resolved');

    return {
      revenueMTD,
      revenueYTD,
      expensesMTD,
      expensesYTD,
      netProfitMTD,
      netProfitYTD,
      totalRevenue:  sumRevenue(revenueItems),
      totalExpenses: sumExpense(expenseItems),
      pendingCRs,
      completedCRs,
      pendingCRCount:   pendingCRs.length,
      completedCRCount: completedCRs.length,
    };
  }, [revenueItems, expenseItems, data.cashRequisitions, convertAmount]);

  return {
    ...data,
    revenueItems,
    expenseItems,
    ...financialSummary,
    refetch: stableRefetch,
  };
}
