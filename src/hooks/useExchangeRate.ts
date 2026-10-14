import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { devLog } from '../lib/devLog';
import { realtimeManager } from '../lib/realtimeManager';
import { logEvent } from '../lib/eventLogger';
import type { ExchangeRate, Currency } from '../types/dashboard';

// Default fallback rates (only used if database fetch fails, or before the
// live fetch resolves) — exported so every screen's default prop falls back
// to this ONE constant instead of its own hand-copied numbers drifting out
// of sync with each other.
export const DEFAULT_RATES = {
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

      devLog('[ExchangeRate] Fetching live exchange rates from database...');

      // Fetch all exchange rates - select all columns to handle different schema versions
      const { data, error: fetchError } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.warn('[ExchangeRate] Error fetching exchange rates:', fetchError);
        console.warn('[ExchangeRate] Using default fallback rates');
        logEvent('exchange_rate_fetch_failed', fetchError.message, {}, 'warning');
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
        devLog(`[ExchangeRate] UGX rate: ${rates.UGX} (from database)`);
      } else {
        devLog(`[ExchangeRate] UGX rate not found, using default: ${rates.UGX}`);
      }

      if (latestRates.has('KES')) {
        rates.KES = latestRates.get('KES')!;
        devLog(`[ExchangeRate] KES rate: ${rates.KES} (from database)`);
      } else {
        devLog(`[ExchangeRate] KES rate not found, using default: ${rates.KES}`);
      }

      setExchangeRates(rates);
      devLog('[ExchangeRate] Exchange rates updated successfully:', rates);
    } catch (err) {
      console.error('[ExchangeRate] Exchange rate fetch error:', err);
      logEvent('exchange_rate_fetch_exception', (err as Error)?.message || 'Unknown error');
      setError(err as Error);
      setExchangeRates(DEFAULT_RATES);
    } finally {
      setLoading(false);
    }
  }, []);

  // Subscribe to real-time updates — routed through the shared realtimeManager
  // so Dashboard + Finance (both mount this hook) share ONE channel instead of
  // each opening its own under the identical name 'exchange-rates-changes'.
  useEffect(() => {
    fetchExchangeRate();

    devLog('[ExchangeRate] Registering with realtimeManager...');
    const unsubscribe = realtimeManager.subscribe(
      ['exchange_rates'],
      () => {
        devLog('[ExchangeRate] Exchange rate updated in database, refetching...');
        fetchExchangeRate();
      },
      'useExchangeRate',
    );

    // Refresh hourly as backup
    const interval = setInterval(() => {
      devLog('[ExchangeRate] Hourly refresh triggered');
      fetchExchangeRate();
    }, REFRESH_INTERVAL);

    return () => {
      devLog('[ExchangeRate] Cleaning up subscription and interval');
      unsubscribe();
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
 * Resolves an amount for display in `toCurrency` — the single conversion
 * path every screen should use, so the same record never shows two
 * different dollar values depending on where it's rendered.
 *
 * Found in production: cash_requisitions.amount_usd is a USD snapshot taken
 * when the requisition was raised (the value the web dashboard shows and
 * never recalculates). One mobile screen was recomputing a CR's dollar
 * value live from total_cost against TODAY's exchange rate on every
 * render — so the exact same CR showed a different "requested amount" in
 * the Finance list than in its own detail view, and that number silently
 * drifted further every time the UGX/USD rate moved. A live rate must
 * never override a stored historical snapshot; it only fills in when no
 * snapshot exists for the requested currency.
 */
export function resolveDisplayAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
  usdSnapshot?: number | null,
): number {
  if (fromCurrency === toCurrency) return amount;
  if (toCurrency === 'USD' && usdSnapshot != null) return usdSnapshot;
  const fromRate = rates[fromCurrency] || 1;
  const toRate   = rates[toCurrency] || 1;
  return (amount / fromRate) * toRate;
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
