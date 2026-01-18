import { useState, useEffect, useCallback } from 'react';
import {
  getCache,
  setCache,
  getCacheForOffline,
  CACHE_EXPIRATION,
} from '../lib/cache';

/**
 * Generic hook for fetching data with offline cache support
 *
 * @param cacheKey - Unique key for caching this data
 * @param fetchFn - Async function that fetches the data
 * @param options - Configuration options
 */

interface UseCachedDataOptions {
  /** Cache expiration time in milliseconds */
  expiration?: number;
  /** Whether to fetch fresh data on mount even if cache exists */
  fetchOnMount?: boolean;
  /** Dependencies that trigger a refetch when changed */
  dependencies?: unknown[];
}

interface UseCachedDataResult<T> {
  /** The data (from cache or fresh fetch) */
  data: T | null;
  /** Whether data is currently being fetched */
  loading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Whether the current data is from cache (possibly stale) */
  isFromCache: boolean;
  /** Timestamp of when the data was last fetched */
  lastUpdated: number | null;
  /** Function to manually trigger a refresh */
  refresh: () => Promise<void>;
}

export function useCachedData<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options: UseCachedDataOptions = {}
): UseCachedDataResult<T> {
  const {
    expiration = CACHE_EXPIRATION.MEDIUM,
    fetchOnMount = true,
    dependencies = [],
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Load cached data on mount
  useEffect(() => {
    const loadCachedData = async () => {
      const cached = await getCacheForOffline<T>(cacheKey);
      if (cached.data) {
        setData(cached.data);
        setIsFromCache(true);
        setLastUpdated(cached.timestamp);
        setLoading(false);
      }
    };

    loadCachedData();
  }, [cacheKey]);

  // Fetch fresh data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const freshData = await fetchFn();
      setData(freshData);
      setIsFromCache(false);
      setLastUpdated(Date.now());
      setError(null);

      // Save to cache
      await setCache(cacheKey, freshData, expiration);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch data');
      setError(fetchError);

      // If we have cached data, keep it (offline fallback)
      if (!data) {
        const cached = await getCacheForOffline<T>(cacheKey);
        if (cached.data) {
          setData(cached.data);
          setIsFromCache(true);
          setLastUpdated(cached.timestamp);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [cacheKey, expiration, fetchFn, data]);

  // Fetch on mount if enabled
  useEffect(() => {
    if (fetchOnMount) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchOnMount, ...dependencies]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    isFromCache,
    lastUpdated,
    refresh,
  };
}

export default useCachedData;
