import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { FinancialTransaction, CashRequisition, Currency } from '../types/dashboard';

interface FinanceDataState {
  transactions: FinancialTransaction[];
  cashRequisitions: CashRequisition[];
  loading: boolean;
  error: Error | null;
}

interface UseFinanceDataProps {
  currency?: Currency;
}

// Generate a unique fetch ID for debugging
let fetchCounter = 0;

export function useFinanceData({ currency = 'USD' }: UseFinanceDataProps = {}) {
  const [data, setData] = useState<FinanceDataState>({
    transactions: [],
    cashRequisitions: [],
    loading: true,
    error: null,
  });

  // Track if initial fetch has been done
  const hasFetchedRef = useRef(false);

  // Fetch Financial Transactions
  const fetchTransactions = useCallback(async (fetchId: number) => {
    console.log(`[FinanceData #${fetchId}] Fetching transactions...`);

    const { data: transactions, error } = await supabase
      .from('financial_transactions')
      .select('id, transaction_date, amount, transaction_type, category, currency, description, reference_number, status')
      .neq('status', 'cancelled')
      .order('transaction_date', { ascending: false })
      .limit(100);

    if (error) {
      console.error(`[FinanceData #${fetchId}] ERROR fetching transactions:`, error.message);
      throw error;
    }

    const result = (transactions || []) as FinancialTransaction[];
    console.log(`[FinanceData #${fetchId}] Fetched ${result.length} transactions`);

    if (result.length > 0) {
      const typeBreakdown = result.reduce((acc, t) => {
        acc[t.transaction_type] = (acc[t.transaction_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`[FinanceData #${fetchId}] Transaction types:`, typeBreakdown);
    }

    return result;
  }, []);

  // Fetch Cash Requisitions
  const fetchCashRequisitions = useCallback(async (fetchId: number) => {
    console.log(`[FinanceData #${fetchId}] Fetching cash requisitions...`);

    const { data: crs, error } = await supabase
      .from('cash_requisitions')
      .select('id, cr_number, total_cost, currency, status, date_needed, expense_category, date_completed, created_at, amount_usd, description, requested_by')
      .eq('soft_deleted', false)
      .not('status', 'in', '(Declined,Rejected)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error(`[FinanceData #${fetchId}] ERROR fetching CRs:`, error.message);
      throw error;
    }

    const result = (crs || []) as CashRequisition[];
    console.log(`[FinanceData #${fetchId}] Fetched ${result.length} CRs`);

    if (result.length > 0) {
      const statusBreakdown = result.reduce((acc, cr) => {
        acc[cr.status] = (acc[cr.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`[FinanceData #${fetchId}] CR statuses:`, statusBreakdown);
    }

    return result;
  }, []);

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    const fetchId = ++fetchCounter;

    console.log(`[FinanceData #${fetchId}] ========== FETCH START ==========`);

    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      console.log(`[FinanceData #${fetchId}] Starting parallel fetches...`);
      const startTime = Date.now();

      const [transactions, cashRequisitions] = await Promise.all([
        fetchTransactions(fetchId),
        fetchCashRequisitions(fetchId),
      ]);

      const fetchDuration = Date.now() - startTime;
      console.log(`[FinanceData #${fetchId}] All fetches completed in ${fetchDuration}ms`);

      console.log(`[FinanceData #${fetchId}] ========== FETCH SUMMARY ==========`);
      console.log(`[FinanceData #${fetchId}] Transactions: ${transactions.length}`);
      console.log(`[FinanceData #${fetchId}] CRs: ${cashRequisitions.length}`);

      hasFetchedRef.current = true;

      setData({
        transactions,
        cashRequisitions,
        loading: false,
        error: null,
      });

      console.log(`[FinanceData #${fetchId}] ========== FETCH COMPLETE ==========`);
    } catch (error) {
      console.error(`[FinanceData #${fetchId}] ========== FETCH ERROR ==========`);
      console.error(`[FinanceData #${fetchId}] Error:`, error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error as Error,
      }));
    }
  }, [fetchTransactions, fetchCashRequisitions]);

  // Fetch on mount
  useEffect(() => {
    console.log('[FinanceData] useEffect triggered - fetching data...');
    fetchAllData();
  }, [fetchAllData]);

  // Create a stable refetch reference
  const refetchRef = useRef(fetchAllData);
  refetchRef.current = fetchAllData;

  const stableRefetch = useCallback(() => {
    console.log('[FinanceData] stableRefetch called');
    return refetchRef.current();
  }, []);

  // Compute financial summaries
  const financialSummary = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Calculate totals
    const incomeTransactions = data.transactions.filter(
      t => t.transaction_type === 'income' && t.status !== 'cancelled'
    );
    const expenseTransactions = data.transactions.filter(
      t => t.transaction_type === 'expense' && t.status !== 'cancelled'
    );

    // This month's transactions
    const mtdIncome = incomeTransactions.filter(t => {
      const date = new Date(t.transaction_date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
    const mtdExpenses = expenseTransactions.filter(t => {
      const date = new Date(t.transaction_date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    // YTD transactions
    const ytdIncome = incomeTransactions.filter(t => {
      const date = new Date(t.transaction_date);
      return date.getFullYear() === currentYear;
    });
    const ytdExpenses = expenseTransactions.filter(t => {
      const date = new Date(t.transaction_date);
      return date.getFullYear() === currentYear;
    });

    // Calculate amounts (convert to display currency)
    const convertAmount = (amount: number, fromCurrency: string): number => {
      // Simple conversion rates - in production, use real-time rates
      const rates: Record<string, number> = { USD: 1, UGX: 3700, KES: 130 };
      const fromRate = rates[fromCurrency] || 1;
      const toRate = rates[currency] || 1;
      return (amount / fromRate) * toRate;
    };

    const sumAmounts = (items: FinancialTransaction[]) =>
      items.reduce((sum, t) => sum + convertAmount(t.amount, t.currency || 'USD'), 0);

    const revenueMTD = sumAmounts(mtdIncome);
    const revenueYTD = sumAmounts(ytdIncome);
    const expensesMTD = sumAmounts(mtdExpenses);
    const expensesYTD = sumAmounts(ytdExpenses);
    const netProfitMTD = revenueMTD - expensesMTD;
    const netProfitYTD = revenueYTD - expensesYTD;

    // CR Summary
    const pendingCRs = data.cashRequisitions.filter(cr =>
      cr.status === 'Pending' || cr.status === 'Approved'
    );
    const completedCRs = data.cashRequisitions.filter(cr =>
      cr.status === 'Completed' || cr.status === 'Resolved'
    );

    console.log('[FinanceData] Financial summary computed:', {
      revenueMTD,
      revenueYTD,
      expensesMTD,
      expensesYTD,
      netProfitMTD,
      pendingCRs: pendingCRs.length,
    });

    return {
      revenueMTD,
      revenueYTD,
      expensesMTD,
      expensesYTD,
      netProfitMTD,
      netProfitYTD,
      totalIncome: sumAmounts(incomeTransactions),
      totalExpenses: sumAmounts(expenseTransactions),
      pendingCRs,
      completedCRs,
      pendingCRCount: pendingCRs.length,
      completedCRCount: completedCRs.length,
    };
  }, [data.transactions, data.cashRequisitions, currency]);

  return {
    ...data,
    ...financialSummary,
    refetch: stableRefetch,
  };
}
