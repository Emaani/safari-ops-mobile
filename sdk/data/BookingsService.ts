/**
 * Bookings Service
 */

import type { APIService } from '../api/APIService';
import type { Logger } from '../utils/Logger';

export interface Booking {
  id: string;
  customer_name: string;
  safari_date: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  total_amount: number;
  created_at: string;
}

export interface BookingFilter {
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class BookingsService {
  private api: APIService;
  private logger: Logger;

  constructor(api: APIService, logger: Logger) {
    this.api = api;
    this.logger = logger;
  }

  public async getBookings(filter?: BookingFilter): Promise<Booking[]> {
    const params: Record<string, string> = {};
    if (filter?.status) params.status = filter.status;
    if (filter?.startDate) params.start_date = filter.startDate;
    if (filter?.endDate) params.end_date = filter.endDate;
    if (filter?.limit) params.limit = filter.limit.toString();
    if (filter?.offset) params.offset = filter.offset.toString();

    const response = await this.api.get<Booking[]>('/bookings', params);
    return response.data;
  }

  public async getBooking(id: string): Promise<Booking> {
    const response = await this.api.get<Booking>(`/bookings/${id}`);
    return response.data;
  }

  public async createBooking(data: Partial<Booking>): Promise<Booking> {
    const response = await this.api.post<Booking>('/bookings', data);
    return response.data;
  }

  public async updateBooking(id: string, data: Partial<Booking>): Promise<Booking> {
    const response = await this.api.patch<Booking>(`/bookings/${id}`, data);
    return response.data;
  }

  public async deleteBooking(id: string): Promise<void> {
    await this.api.delete(`/bookings/${id}`);
  }
}
