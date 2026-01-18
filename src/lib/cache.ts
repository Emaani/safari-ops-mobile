import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cache utility for offline data persistence
 * Uses AsyncStorage to cache API responses for offline access
 */

// Cache key prefixes
const CACHE_PREFIX = '@safari_ops_cache:';
const CACHE_METADATA_PREFIX = '@safari_ops_cache_meta:';

// Default cache expiration time (1 hour in milliseconds)
const DEFAULT_EXPIRATION = 60 * 60 * 1000;

interface CacheMetadata {
  timestamp: number;
  expiration: number;
}

interface CacheEntry<T> {
  data: T;
  metadata: CacheMetadata;
}

/**
 * Save data to cache with optional expiration
 */
export async function setCache<T>(
  key: string,
  data: T,
  expirationMs: number = DEFAULT_EXPIRATION
): Promise<void> {
  try {
    const cacheKey = CACHE_PREFIX + key;
    const metaKey = CACHE_METADATA_PREFIX + key;

    const metadata: CacheMetadata = {
      timestamp: Date.now(),
      expiration: expirationMs,
    };

    await AsyncStorage.multiSet([
      [cacheKey, JSON.stringify(data)],
      [metaKey, JSON.stringify(metadata)],
    ]);
  } catch (error) {
    console.error('[Cache] Error saving to cache:', error);
  }
}

/**
 * Get data from cache if it exists and is not expired
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const cacheKey = CACHE_PREFIX + key;
    const metaKey = CACHE_METADATA_PREFIX + key;

    const results = await AsyncStorage.multiGet([cacheKey, metaKey]);
    const dataResult = results[0][1];
    const metaResult = results[1][1];

    if (!dataResult || !metaResult) {
      return null;
    }

    const metadata: CacheMetadata = JSON.parse(metaResult);
    const now = Date.now();

    // Check if cache is expired
    if (now - metadata.timestamp > metadata.expiration) {
      // Cache expired, remove it
      await removeCache(key);
      return null;
    }

    return JSON.parse(dataResult) as T;
  } catch (error) {
    console.error('[Cache] Error reading from cache:', error);
    return null;
  }
}

/**
 * Get cached data even if expired (for offline fallback)
 */
export async function getCacheForOffline<T>(key: string): Promise<{
  data: T | null;
  isExpired: boolean;
  timestamp: number | null;
}> {
  try {
    const cacheKey = CACHE_PREFIX + key;
    const metaKey = CACHE_METADATA_PREFIX + key;

    const results = await AsyncStorage.multiGet([cacheKey, metaKey]);
    const dataResult = results[0][1];
    const metaResult = results[1][1];

    if (!dataResult) {
      return { data: null, isExpired: true, timestamp: null };
    }

    const data = JSON.parse(dataResult) as T;
    const metadata: CacheMetadata = metaResult
      ? JSON.parse(metaResult)
      : { timestamp: 0, expiration: 0 };

    const now = Date.now();
    const isExpired = now - metadata.timestamp > metadata.expiration;

    return {
      data,
      isExpired,
      timestamp: metadata.timestamp,
    };
  } catch (error) {
    console.error('[Cache] Error reading offline cache:', error);
    return { data: null, isExpired: true, timestamp: null };
  }
}

/**
 * Remove a specific cache entry
 */
export async function removeCache(key: string): Promise<void> {
  try {
    const cacheKey = CACHE_PREFIX + key;
    const metaKey = CACHE_METADATA_PREFIX + key;
    await AsyncStorage.multiRemove([cacheKey, metaKey]);
  } catch (error) {
    console.error('[Cache] Error removing from cache:', error);
  }
}

/**
 * Clear all cached data
 */
export async function clearAllCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(
      (key) =>
        key.startsWith(CACHE_PREFIX) || key.startsWith(CACHE_METADATA_PREFIX)
    );
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch (error) {
    console.error('[Cache] Error clearing cache:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  entries: number;
  keys: string[];
}> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((key) => key.startsWith(CACHE_PREFIX));
    return {
      entries: cacheKeys.length,
      keys: cacheKeys.map((key) => key.replace(CACHE_PREFIX, '')),
    };
  } catch (error) {
    console.error('[Cache] Error getting cache stats:', error);
    return { entries: 0, keys: [] };
  }
}

// Cache keys for different data types
export const CACHE_KEYS = {
  DASHBOARD_DATA: 'dashboard_data',
  BOOKINGS: 'bookings',
  VEHICLES: 'vehicles',
  FINANCE_TRANSACTIONS: 'finance_transactions',
  CASH_REQUISITIONS: 'cash_requisitions',
  EXCHANGE_RATES: 'exchange_rates',
  NOTIFICATIONS: 'notifications',
} as const;

// Cache expiration times
export const CACHE_EXPIRATION = {
  SHORT: 5 * 60 * 1000, // 5 minutes
  MEDIUM: 30 * 60 * 1000, // 30 minutes
  LONG: 60 * 60 * 1000, // 1 hour
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 hours
} as const;
