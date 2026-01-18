/**
 * Dashboard Service
 *
 * Handles dashboard data and metrics
 */

import type { APIService } from '../api/APIService';
import type { Logger } from '../utils/Logger';

export interface DashboardMetrics {
  totalRevenue: number;
  totalBookings: number;
  activeVehicles: number;
  averageBookingValue: number;
  revenueTrend: number; // percentage change
  bookingsTrend: number; // percentage change
}

export interface DashboardData {
  metrics: DashboardMetrics;
  recentBookings: any[];
  revenueByMonth: Array<{ month: string; revenue: number }>;
  bookingsByStatus: Array<{ status: string; count: number }>;
  topDestinations: Array<{ destination: string; count: number }>;
}

export interface DashboardFilter {
  year?: number;
  month?: number | 'all';
  startDate?: string;
  endDate?: string;
}

export class DashboardService {
  private api: APIService;
  private logger: Logger;

  constructor(api: APIService, logger: Logger) {
    this.api = api;
    this.logger = logger;
  }

  /**
   * Get dashboard data
   */
  public async getDashboardData(filter?: DashboardFilter): Promise<DashboardData> {
    this.logger.info('[Dashboard] Getting dashboard data', filter);

    try {
      const params: Record<string, string> = {};

      if (filter?.year) params.year = filter.year.toString();
      if (filter?.month) params.month = filter.month.toString();
      if (filter?.startDate) params.start_date = filter.startDate;
      if (filter?.endDate) params.end_date = filter.endDate;

      const response = await this.api.get<DashboardData>('/dashboard', params);
      return response.data;
    } catch (error) {
      this.logger.error('[Dashboard] Error getting dashboard data', error);
      throw error;
    }
  }

  /**
   * Get dashboard metrics
   */
  public async getMetrics(filter?: DashboardFilter): Promise<DashboardMetrics> {
    this.logger.info('[Dashboard] Getting metrics', filter);

    try {
      const params: Record<string, string> = {};

      if (filter?.year) params.year = filter.year.toString();
      if (filter?.month) params.month = filter.month.toString();

      const response = await this.api.get<DashboardMetrics>('/dashboard/metrics', params);
      return response.data;
    } catch (error) {
      this.logger.error('[Dashboard] Error getting metrics', error);
      throw error;
    }
  }

  /**
   * Get revenue by month
   */
  public async getRevenueByMonth(year: number): Promise<Array<{ month: string; revenue: number }>> {
    this.logger.info('[Dashboard] Getting revenue by month', year);

    try {
      const response = await this.api.get(`/dashboard/revenue-by-month`, { year: year.toString() });
      return response.data;
    } catch (error) {
      this.logger.error('[Dashboard] Error getting revenue by month', error);
      throw error;
    }
  }

  /**
   * Get bookings by status
   */
  public async getBookingsByStatus(filter?: DashboardFilter): Promise<Array<{ status: string; count: number }>> {
    this.logger.info('[Dashboard] Getting bookings by status', filter);

    try {
      const params: Record<string, string> = {};
      if (filter?.year) params.year = filter.year.toString();
      if (filter?.month) params.month = filter.month.toString();

      const response = await this.api.get(`/dashboard/bookings-by-status`, params);
      return response.data;
    } catch (error) {
      this.logger.error('[Dashboard] Error getting bookings by status', error);
      throw error;
    }
  }
}
