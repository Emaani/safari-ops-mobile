import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ExchangeRate, Currency } from '../types/dashboard';

// Default fallback rates (only used if database fetch fails)
const DEFAULT_RATES = {
  USD: 1,      // Base currency
  UGX: 3670,   // Fallback for Uganda Shilling
  KES: 130,    // Fallback for Kenya Shilling
};

const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour

export interface ExchangeRates {
  USD: number;
  UGX: number;
  KES: number;
}

export function useExchangeRate() {
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(DEFAULT_RATES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchExchangeRate = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[ExchangeRate] Fetching live exchange rates from database...');

      // Fetch all exchange rates - select all columns to handle different schema versions
      const { data, error: fetchError } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.warn('[ExchangeRate] Error fetching exchange rates:', fetchError);
        console.warn('[ExchangeRate] Using default fallback rates');
        setExchangeRates(DEFAULT_RATES);
        return;
      }

      if (!data || data.length === 0) {
        console.warn('[ExchangeRate] No exchange rates found in database');
        console.warn('[ExchangeRate] Using default fallback rates');
        setExchangeRates(DEFAULT_RATES);
        return;
      }

      // Build rates object from database results
      const rates: ExchangeRates = {
        USD: 1, // Base currency is always 1
        UGX: DEFAULT_RATES.UGX, // Start with defaults
        KES: DEFAULT_RATES.KES,
      };

      // Get the most recent rate for each currency
      // Handle different schema formats (with or without from_currency column)
      const latestRates = new Map<string, number>();
      data.forEach((rate: any) => {
        // Handle schema with from_currency/to_currency columns
        if (rate.from_currency === 'USD' && rate.to_currency) {
          if (!latestRates.has(rate.to_currency)) {
            latestRates.set(rate.to_currency, rate.rate);
          }
        }
        // Handle schema with just currency and rate columns
        else if (rate.currency && rate.rate) {
          if (!latestRates.has(rate.currency)) {
            latestRates.set(rate.currency, rate.rate);
          }
        }
      });

      // Apply fetched rates
      if (latestRates.has('UGX')) {
        rates.UGX = latestRates.get('UGX')!;
        console.log(`[ExchangeRate] UGX rate: ${rates.UGX} (from database)`);
      } else {
        console.warn(`[ExchangeRate] UGX rate not found, using default: ${rates.UGX}`);
      }

      if (latestRates.has('KES')) {
        rates.KES = latestRates.get('KES')!;
        console.log(`[ExchangeRate] KES rate: ${rates.KES} (from database)`);
      } else {
        console.warn(`[ExchangeRate] KES rate not found, using default: ${rates.KES}`);
      }

      setExchangeRates(rates);
      console.log('[ExchangeRate] Exchange rates updated successfully:', rates);
    } catch (err) {
      console.error('[ExchangeRate] Exchange rate fetch error:', err);
      setError(err as Error);
      setExchangeRates(DEFAULT_RATES);
    } finally {
      setLoading(false);
    }
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    fetchExchangeRate();

    console.log('[ExchangeRate] Setting up real-time subscription...');
    const channel = supabase
      .channel('exchange-rates-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'exchange_rates',
        },
        () => {
          console.log('[ExchangeRate] Exchange rate updated in database, refetching...');
          fetchExchangeRate();
        }
      )
      .subscribe();

    // Refresh hourly as backup
    const interval = setInterval(() => {
      console.log('[ExchangeRate] Hourly refresh triggered');
      fetchExchangeRate();
    }, REFRESH_INTERVAL);

    return () => {
      console.log('[ExchangeRate] Cleaning up subscription and interval');
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchExchangeRate]);

  // Backward compatibility: return currentRate (UGX) and exchangeRates
  return {
    currentRate: exchangeRates.UGX, // For backward compatibility
    exchangeRates,
    loading,
    error,
    refresh: fetchExchangeRate,
  };
}

/**
 * Get conversion rates object for all currencies
 * Now fully dynamic - uses rates fetched from database
 */
export function getConversionRates(exchangeRates: ExchangeRates): Record<Currency, number> {
  return {
    USD: exchangeRates.USD,
    UGX: exchangeRates.UGX,
    KES: exchangeRates.KES,
  };
}

/**
 * Convert amount from any currency to base currency (USD)
 */
export function convertToBaseCurrency(
  amount: number,
  fromCurrency: Currency,
  conversionRates: Record<Currency, number>
): number {
  return amount / conversionRates[fromCurrency];
}

/**
 * Convert amount from base currency (USD) to any currency
 */
export function convertFromBaseCurrency(
  amount: number,
  toCurrency: Currency,
  conversionRates: Record<Currency, number>
): number {
  return amount * conversionRates[toCurrency];
}
