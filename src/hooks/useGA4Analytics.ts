/**
 * useGA4Analytics
 *
 * Fetches GA4 traffic & engagement data via the ga4-analytics Supabase Edge Function.
 *
 * Features:
 *  - 3-minute in-memory cache per date range key
 *  - 2 retries with 2s → 4s exponential backoff
 *  - AbortController support (cancels in-flight requests on unmount/param change)
 *  - Falls back to stale cache when GA4 is unavailable
 *  - Returns typed GA4Report | null alongside loading/error/stale states
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GA4Summary {
  sessions: number;
  activeUsers: number;
  newUsers: number;
  screenPageViews: number;
  userEngagementDuration: number;
  engagedSessions: number;
  eventCount: number;
  keyEvents: number;
}

export interface GA4DataPoint {
  date: string;      // YYYYMMDD
  sessions: number;
  activeUsers: number;
}

export interface GA4PageRow {
  path: string;
  views: number;
  sessions: number;
  engagedSessions: number;
  pct: number;
}

export interface GA4SourceRow {
  source: string;
  medium: string;
  sessions: number;
  activeUsers: number;
  pct: number;
}

export interface GA4AudienceRow {
  label: string;
  activeUsers: number;
  sessions: number;
  pct: number;
}

export interface GA4Channels {
  Organic: number;
  Direct: number;
  Social: number;
  Paid: number;
  Referral: number;
  Email: number;
  Other: number;
}

export interface GA4Report {
  ok: boolean;
  dateRange: { startDate: string; endDate: string };
  fetchedAt: string;
  summary: GA4Summary;
  timeSeries: GA4DataPoint[];
  topPages: GA4PageRow[];
  sourceMedium: GA4SourceRow[];
  channels: GA4Channels;
  socialTraffic: Record<string, number>;
  audience: {
    countries: GA4AudienceRow[];
    devices: GA4AudienceRow[];
  };
}

export type DatePreset = '7d' | '30d' | '90d';

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

interface CacheEntry {
  data: GA4Report;
  expiresAt: number;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(startDate: string, endDate: string) {
  return `${startDate}__${endDate}`;
}

function getFromCache(key: string): { data: GA4Report; stale: boolean } | null {
  const entry = cache.get(key);
  if (!entry) return null;
  return { data: entry.data, stale: Date.now() > entry.expiresAt };
}

function setCache(key: string, data: GA4Report) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS, fetchedAt: Date.now() });
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function presetToDateRange(preset: DatePreset): { startDate: string; endDate: string } {
  const map: Record<DatePreset, string> = {
    '7d':  '7daysAgo',
    '30d': '30daysAgo',
    '90d': '90daysAgo',
  };
  return { startDate: map[preset], endDate: 'today' };
}

// ─── Fetch with retry ─────────────────────────────────────────────────────────

async function fetchGA4(
  startDate: string,
  endDate: string,
  signal: AbortSignal,
  attempt = 0,
): Promise<GA4Report> {
  const MAX_RETRIES = 2;
  try {
    const { data, error } = await supabase.functions.invoke('ga4-analytics', {
      body: { startDate, endDate, limit: 25 },
    });

    if (error) throw new Error(error.message ?? 'Edge function error');
    if (!data?.ok) throw new Error(data?.error ?? 'GA4 returned non-ok response');

    return data as GA4Report;
  } catch (err: any) {
    if (signal.aborted) throw err;
    if (attempt < MAX_RETRIES) {
      const delay = Math.pow(2, attempt) * 2000; // 2s, 4s
      await new Promise(res => setTimeout(res, delay));
      if (signal.aborted) throw err;
      return fetchGA4(startDate, endDate, signal, attempt + 1);
    }
    throw err;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseGA4AnalyticsResult {
  data: GA4Report | null;
  loading: boolean;
  refreshing: boolean;
  stale: boolean;           // true when showing cached data that has expired
  error: string | null;
  unavailable: boolean;     // true when GA4 is not configured (missing env vars)
  refresh: () => void;
}

export function useGA4Analytics(preset: DatePreset = '30d'): UseGA4AnalyticsResult {
  const { startDate, endDate } = presetToDateRange(preset);
  const key = cacheKey(startDate, endDate);

  const [data,        setData]        = useState<GA4Report | null>(() => getFromCache(key)?.data ?? null);
  const [loading,     setLoading]     = useState<boolean>(!cache.has(key));
  const [refreshing,  setRefreshing]  = useState<boolean>(false);
  const [stale,       setStale]       = useState<boolean>(false);
  const [error,       setError]       = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<boolean>(false);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    // Check cache first
    const cached = getFromCache(key);
    if (cached && !cached.stale && !isRefresh) {
      setData(cached.data);
      setLoading(false);
      setStale(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    // Cancel previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const report = await fetchGA4(startDate, endDate, controller.signal);
      if (!controller.signal.aborted) {
        setCache(key, report);
        setData(report);
        setStale(false);
        setUnavailable(false);
        setError(null);
      }
    } catch (err: any) {
      if (controller.signal.aborted) return;

      const msg: string = err.message ?? 'Unknown error';
      const isMissingEnv = msg.includes('MISSING_ENV') || msg.includes('not configured');

      // Fall back to stale cache
      const staleCache = getFromCache(key);
      if (staleCache) {
        setData(staleCache.data);
        setStale(true);
        setError(isMissingEnv ? null : 'Live GA4 unavailable — showing cached data');
      } else {
        setData(null);
        setError(isMissingEnv
          ? null   // Show setup screen, not error
          : 'Unable to load analytics. Pull down to retry.');
      }
      setUnavailable(isMissingEnv);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [key, startDate, endDate]);

  // Reload when preset changes
  useEffect(() => {
    const cached = getFromCache(key);
    if (cached && !cached.stale) {
      setData(cached.data);
      setLoading(false);
      setStale(false);
    } else {
      setLoading(true);
      setData(cached?.data ?? null);
      setStale(cached != null);
    }
    load(false);
    return () => { abortRef.current?.abort(); };
  }, [key]);

  const refresh = useCallback(() => {
    // Invalidate cache entry for this key
    cache.delete(key);
    load(true);
  }, [key, load]);

  return { data, loading, refreshing, stale, error, unavailable, refresh };
}
