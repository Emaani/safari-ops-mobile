/**
 * useFinance Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { JackalSDK } from '../core/JackalSDK';
import { FinanceService } from '../data/FinanceService';
import type { Transaction, FinancialSummary } from '../data/FinanceService';

export function useFinance(year: number, month?: number) {
  const sdk = JackalSDK.getInstance();
  const financeService = new FinanceService(sdk.api, sdk.logger);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchFinanceData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [transactionsData, summaryData] = await Promise.all([
        financeService.getTransactions(),
        financeService.getFinancialSummary(year, month),
      ]);

      setTransactions(transactionsData);
      setSummary(summaryData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchFinanceData();
  }, [fetchFinanceData]);

  const createTransaction = useCallback(async (data: Partial<Transaction>) => {
    const newTransaction = await financeService.createTransaction(data);
    setTransactions((prev) => [...prev, newTransaction]);
    await fetchFinanceData(); // Refresh summary
    return newTransaction;
  }, [fetchFinanceData]);

  return {
    transactions,
    summary,
    loading,
    error,
    refetch: fetchFinanceData,
    createTransaction,
  };
}
