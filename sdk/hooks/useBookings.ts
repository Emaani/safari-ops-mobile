/**
 * useBookings Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { JackalSDK } from '../core/JackalSDK';
import { BookingsService } from '../data/BookingsService';
import type { Booking, BookingFilter } from '../data/BookingsService';

export function useBookings(filter?: BookingFilter) {
  const sdk = JackalSDK.getInstance();
  const bookingsService = new BookingsService(sdk.api, sdk.logger);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await bookingsService.getBookings(filter);
      setBookings(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const createBooking = useCallback(async (data: Partial<Booking>) => {
    const newBooking = await bookingsService.createBooking(data);
    setBookings((prev) => [...prev, newBooking]);
    return newBooking;
  }, []);

  const updateBooking = useCallback(async (id: string, data: Partial<Booking>) => {
    const updatedBooking = await bookingsService.updateBooking(id, data);
    setBookings((prev) => prev.map((b) => (b.id === id ? updatedBooking : b)));
    return updatedBooking;
  }, []);

  const deleteBooking = useCallback(async (id: string) => {
    await bookingsService.deleteBooking(id);
    setBookings((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return {
    bookings,
    loading,
    error,
    refetch: fetchBookings,
    createBooking,
    updateBooking,
    deleteBooking,
  };
}
