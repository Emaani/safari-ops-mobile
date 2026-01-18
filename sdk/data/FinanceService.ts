/**
 * Finance Service
 */

import type { APIService } from '../api/APIService';
import type { Logger } from '../utils/Logger';

export interface Transaction {
  id: string;
  booking_id: string;
  amount: number;
  currency: string;
  type: 'payment' | 'refund' | 'expense';
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

export interface FinancialSummary {
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  outstanding_payments: number;
}

export class FinanceService {
  private api: APIService;
  private logger: Logger;

  constructor(api: APIService, logger: Logger) {
    this.api = api;
    this.logger = logger;
  }

  public async getTransactions(filter?: { startDate?: string; endDate?: string }): Promise<Transaction[]> {
    const params: Record<string, string> = {};
    if (filter?.startDate) params.start_date = filter.startDate;
    if (filter?.endDate) params.end_date = filter.endDate;

    const response = await this.api.get<Transaction[]>('/finance/transactions', params);
    return response.data;
  }

  public async getFinancialSummary(year: number, month?: number): Promise<FinancialSummary> {
    const params: Record<string, string> = { year: year.toString() };
    if (month) params.month = month.toString();

    const response = await this.api.get<FinancialSummary>('/finance/summary', params);
    return response.data;
  }

  public async createTransaction(data: Partial<Transaction>): Promise<Transaction> {
    const response = await this.api.post<Transaction>('/finance/transactions', data);
    return response.data;
  }
}
