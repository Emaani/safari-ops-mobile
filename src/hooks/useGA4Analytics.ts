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
  totalUsers: number;
  screenPageViews: number;
  userEngagementDuration: number;
  engagedSessions: number;
  eventCount: number;
  keyEvents: number;
}

export interface GA4Engagement {
  totalUsers: number;
  newUsers: number;
  returningUsers: number;
  avgEngagementTimePerUser: number; // seconds
  engagedSessionsPerUser: number;
  eventCount: number;
  keyEvents: number;
  userKeyEventRate: number;
  keyEventsList: Array<{ eventName: string; keyEvents: number; eventCount: number }>;
}

export interface GA4DataPoint {
  date: string;      // YYYYMMDD
  sessions: number;
  activeUsers: number;
  newUsers?: number;
  pageviews?: number;
}

export interface GA4PageRow {
  path: string;
  views: number;
  sessions: number;
  engagedSessions: number;
  bounceRate?: number;
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

// Ads performance — sourced from Google Ads via GA4's own link, the same way
// the website gets these numbers. No Google Ads API credentials involved;
// confirmed against the live ga4-analytics response shape directly.
export interface GA4AdsCampaign {
  campaign: string;
  impressions: number;
  clicks: number;
  cost: number;
  sessions: number;
  users: number;
  conversions: number;
  engagedSessions: number;
}
export interface GA4AdsTotals {
  impressions: number;
  clicks: number;
  cost: number;
  sessions: number;
  users: number;
  conversions: number;
  ctr: number;
  cpc: number;
  costPerConversion: number;
}
export interface GA4Ads {
  /** False when Google Ads isn't linked to this GA4 property — cost/cpc/
   *  costPerConversion should read "Ad cost data not available" instead of
   *  0 in that case, same as the website. Clicks/impressions/sessions still
   *  come from GA4 itself and remain meaningful either way. */
  costDataAvailable: boolean;
  costNote?: string;
  totals: GA4AdsTotals;
  campaigns: GA4AdsCampaign[];
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
  engagement?: GA4Engagement;
  browserData?: Array<{ browser: string; sessions: number }>;
  ads?: GA4Ads;
}

export type DatePreset = '7d' | '30d' | '90d' | '12m';

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
    '12m': '365daysAgo',
  };
  return { startDate: map[preset], endDate: 'today' };
}

// ─── Web-format transformer ───────────────────────────────────────────────────
// The shared Supabase edge function returns the web app's format.
// Map it to GA4Report so the UI doesn't change.

function transformWebResponse(d: any): GA4Report {
  const eng  = d.engagement   ?? {};
  const kpis = d.kpis         ?? {};
  const totalUsers = eng.totalUsers ?? kpis.activeUsers ?? 0;
  const newUsersVal = eng.newUsers ?? kpis.newUsers ?? 0;

  const summary: GA4Summary = {
    sessions:               kpis.sessions     ?? 0,
    activeUsers:            kpis.activeUsers  ?? 0,
    newUsers:               newUsersVal,
    totalUsers:             totalUsers,
    screenPageViews:        kpis.pageviews    ?? 0,
    userEngagementDuration: Math.round((eng.avgEngagementTimePerUser ?? 0) * totalUsers),
    engagedSessions:        Math.round((eng.engagedSessionsPerUser   ?? 0) * totalUsers),
    eventCount:             eng.eventCount    ?? 0,
    keyEvents:              eng.keyEvents     ?? 0,
  };

  const timeSeries: GA4DataPoint[] = (d.trafficData ?? []).map((r: any) => ({
    date:        r.date      ?? '',
    sessions:    r.sessions  ?? 0,
    activeUsers: r.users     ?? 0,
    newUsers:    r.newUsers  ?? 0,
    pageviews:   r.pageviews ?? 0,
  }));

  const totalViews = (d.topPages ?? []).reduce((s: number, p: any) => s + (p.views ?? 0), 0) || 1;
  const topPages: GA4PageRow[] = (d.topPages ?? []).map((p: any) => ({
    path:            p.page ?? p.path ?? '',
    views:           p.views    ?? 0,
    sessions:        p.sessions ?? 0,
    engagedSessions: p.engagedSessions ?? 0,
    bounceRate:      p.bounceRate,
    pct:             Math.round(((p.views ?? 0) / totalViews) * 100),
  }));

  // Web sourceData is [{name, value}] — map to sourceMedium rows
  const totalSrc = (d.sourceData ?? []).reduce((s: number, r: any) => s + (r.value ?? 0), 0) || 1;
  const sourceMedium: GA4SourceRow[] = (d.sourceData ?? []).map((r: any) => ({
    source:      r.name  ?? '',
    medium:      '',
    sessions:    r.value ?? 0,
    activeUsers: r.value ?? 0,
    pct:         Math.round(((r.value ?? 0) / totalSrc) * 100),
  }));

  // Derive channel buckets from sourceData names
  const channels: GA4Channels = { Organic: 0, Direct: 0, Social: 0, Paid: 0, Referral: 0, Email: 0, Other: 0 };
  const SOCIAL_NAMES = ['facebook','instagram','ig','tiktok','twitter','x','linkedin','youtube','pinterest'];
  const socialTraffic: Record<string, number> = {};
  for (const r of (d.sourceData ?? [])) {
    const name = (r.name ?? '').toLowerCase();
    const val  = r.value ?? 0;
    const socialKey = SOCIAL_NAMES.find(s => name.includes(s));
    if (socialKey) {
      const key = socialKey === 'ig' ? 'instagram' : socialKey;
      socialTraffic[key] = (socialTraffic[key] ?? 0) + val;
      channels.Social += val;
    } else if (name.includes('organic')) channels.Organic += val;
    else if (name.includes('direct'))   channels.Direct   += val;
    else if (name.includes('paid') || name.includes('cpc')) channels.Paid += val;
    else if (name.includes('email'))    channels.Email    += val;
    else if (name.includes('referral')) channels.Referral += val;
    else                                channels.Other    += val;
  }

  const totalCU = (d.countryData ?? []).reduce((s: number, c: any) => s + (c.users ?? 0), 0) || 1;
  const countries: GA4AudienceRow[] = (d.countryData ?? []).map((c: any) => ({
    label: c.country ?? '', activeUsers: c.users ?? 0, sessions: c.sessions ?? 0,
    pct: Math.round(((c.users ?? 0) / totalCU) * 100),
  }));

  const totalDU = (d.deviceData ?? []).reduce((s: number, v: any) => s + (v.users ?? 0), 0) || 1;
  const devices: GA4AudienceRow[] = (d.deviceData ?? []).map((v: any) => ({
    label: v.device ?? '', activeUsers: v.users ?? 0, sessions: v.sessions ?? 0,
    pct: Math.round(((v.users ?? 0) / totalDU) * 100),
  }));

  const engagement: GA4Engagement = {
    totalUsers,
    newUsers:                  newUsersVal,
    returningUsers:            eng.returningUsers  ?? Math.max(0, totalUsers - newUsersVal),
    avgEngagementTimePerUser:  eng.avgEngagementTimePerUser ?? 0,
    engagedSessionsPerUser:    eng.engagedSessionsPerUser   ?? 0,
    eventCount:                eng.eventCount      ?? 0,
    keyEvents:                 eng.keyEvents       ?? 0,
    userKeyEventRate:          eng.userKeyEventRate ?? 0,
    keyEventsList:             eng.keyEventsList   ?? [],
  };

  return {
    ok: true,
    dateRange:    { startDate: '30daysAgo', endDate: 'today' },
    fetchedAt:    new Date().toISOString(),
    summary,
    timeSeries,
    topPages,
    sourceMedium,
    channels,
    socialTraffic,
    audience:     { countries, devices },
    engagement,
    browserData:  d.browserData ?? [],
    ads:          d.ads ?? undefined,
  };
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

    // Accept web format (kpis/trafficData) or legacy mobile format (ok: true)
    const isWebFormat = data?.kpis || data?.trafficData || data?.engagement;
    if (!isWebFormat && !data?.ok) {
      throw new Error(data?.error ?? 'GA4 returned non-ok response');
    }
    if (data?.error && !isWebFormat) throw new Error(data.error);

    return isWebFormat ? transformWebResponse(data) : (data as GA4Report);
  } catch (err: any) {
    if (signal.aborted) throw err;
    if (attempt < MAX_RETRIES) {
      const delay = Math.pow(2, attempt) * 2000;
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
