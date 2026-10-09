/**
 * useGoogleAds
 * Fetches Google Ads campaign data via the google-ads-analytics Supabase Edge Function.
 * 5-minute in-memory cache · 2 retries with exponential backoff · AbortController support
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { DatePreset } from './useGA4Analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoogleAdsSummary {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  ctr: number;           // percentage e.g. 2.5
  avgCpc: number;        // USD
  convRate: number;      // percentage e.g. 3.1
  costPerConv: number;   // USD
  activeCampaigns: number;
  totalCampaigns: number;
}

export interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED' | string;
  channelType: string;
  biddingStrategy: string;
  dailyBudget: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
  convRate: number;
  costPerConv: number;
  pctOfSpend: number;
}

export interface GoogleAdsTrendPoint {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface GoogleAdsAdGroup {
  name: string;
  campaign: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
}

export interface GoogleAdsReport {
  ok: boolean;
  period: string;
  fetchedAt: string;
  summary: GoogleAdsSummary;
  campaigns: GoogleAdsCampaign[];
  trend: GoogleAdsTrendPoint[];
  adGroups: GoogleAdsAdGroup[];
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry { data: GoogleAdsReport; expiresAt: number }
const cache = new Map<string, CacheEntry>();
const getCache = (k: string) => { const e = cache.get(k); return e ? { data: e.data, stale: Date.now() > e.expiresAt } : null; };
const setCache = (k: string, d: GoogleAdsReport) => cache.set(k, { data: d, expiresAt: Date.now() + CACHE_TTL });

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchAds(period: string, signal: AbortSignal, attempt = 0): Promise<GoogleAdsReport> {
  const MAX = 2;
  try {
    const { data, error } = await supabase.functions.invoke('google-ads-analytics', {
      body: { period },
    });

    if (error) {
      const msg = (error.message ?? '').toLowerCase();
      // Function not deployed or infrastructure not ready → treat as unconfigured
      const isInfra = msg.includes('404') || msg.includes('not found') ||
                      msg.includes('relay') || msg.includes('failed to send') ||
                      msg.includes('edge function') ||
                      (error as any)?.context?.status === 404;
      if (isInfra) throw new Error('MISSING_ENV');
      throw new Error(error.message ?? 'Edge function error');
    }

    // Edge function explicitly signals env vars are missing
    if (data?.error === 'MISSING_ENV') throw new Error('MISSING_ENV');
    if (!data?.ok) throw new Error(data?.error ?? 'google-ads returned non-ok');
    return data as GoogleAdsReport;
  } catch (err: any) {
    if (signal.aborted) throw err;
    if (attempt < MAX) {
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 2000));
      if (signal.aborted) throw err;
      return fetchAds(period, signal, attempt + 1);
    }
    throw err;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseGoogleAdsResult {
  data: GoogleAdsReport | null;
  loading: boolean;
  refreshing: boolean;
  stale: boolean;
  error: string | null;
  unavailable: boolean;
  refresh: () => void;
}

export function useGoogleAds(preset: DatePreset = '30d'): UseGoogleAdsResult {
  const key = preset;

  const [data,        setData]        = useState<GoogleAdsReport | null>(() => getCache(key)?.data ?? null);
  const [loading,     setLoading]     = useState<boolean>(!cache.has(key));
  const [refreshing,  setRefreshing]  = useState(false);
  const [stale,       setStale]       = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    const cached = getCache(key);
    if (cached && !cached.stale && !isRefresh) {
      setData(cached.data); setLoading(false); setStale(false); return;
    }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const report = await fetchAds(preset, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setCache(key, report);
        setData(report); setStale(false); setUnavailable(false); setError(null);
      }
    } catch (err: any) {
      if (ctrl.signal.aborted) return;
      const msg: string = err.message ?? 'Unknown error';
      const isEnv = msg.includes('MISSING_ENV') || msg.includes('not configured');
      const staleCache = getCache(key);
      if (staleCache) {
        setData(staleCache.data); setStale(true);
        setError(isEnv ? null : 'Live data unavailable — showing cached data');
      } else {
        setData(null);
        setError(isEnv ? null : 'Unable to load Google Ads data. Pull down to retry.');
      }
      setUnavailable(isEnv);
    } finally {
      if (!ctrl.signal.aborted) { setLoading(false); setRefreshing(false); }
    }
  }, [key, preset]);

  useEffect(() => {
    const cached = getCache(key);
    if (cached && !cached.stale) { setData(cached.data); setLoading(false); setStale(false); }
    else { setLoading(true); setData(cached?.data ?? null); setStale(cached != null); }
    load(false);
    return () => { abortRef.current?.abort(); };
  }, [key]);

  const refresh = useCallback(() => { cache.delete(key); load(true); }, [key, load]);

  return { data, loading, refreshing, stale, error, unavailable, refresh };
}
