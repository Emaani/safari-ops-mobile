/**
 * Storage Service
 *
 * Wrapper around AsyncStorage for persistent key-value storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StorageConfig {
  prefix?: string;
}

export interface StorageItem {
  key: string;
  value: string;
}

const DEFAULT_PREFIX = '@jackal_';

export class StorageService {
  private prefix: string;

  constructor(config: StorageConfig = {}) {
    this.prefix = config.prefix || DEFAULT_PREFIX;
  }

  /**
   * Get item from storage
   */
  public async getItem(key: string): Promise<string | null> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const value = await AsyncStorage.getItem(prefixedKey);
      return value;
    } catch (error) {
      console.error('[Storage] Error getting item:', key, error);
      return null;
    }
  }

  /**
   * Set item in storage
   */
  public async setItem(key: string, value: string): Promise<void> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      await AsyncStorage.setItem(prefixedKey, value);
    } catch (error) {
      console.error('[Storage] Error setting item:', key, error);
      throw error;
    }
  }

  /**
   * Remove item from storage
   */
  public async removeItem(key: string): Promise<void> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      await AsyncStorage.removeItem(prefixedKey);
    } catch (error) {
      console.error('[Storage] Error removing item:', key, error);
      throw error;
    }
  }

  /**
   * Get multiple items
   */
  public async multiGet(keys: string[]): Promise<StorageItem[]> {
    try {
      const prefixedKeys = keys.map((key) => this.getPrefixedKey(key));
      const items = await AsyncStorage.multiGet(prefixedKeys);

      return items.map(([key, value]) => ({
        key: this.removePrefixFromKey(key),
        value: value || '',
      }));
    } catch (error) {
      console.error('[Storage] Error getting multiple items:', error);
      return [];
    }
  }

  /**
   * Set multiple items
   */
  public async multiSet(items: StorageItem[]): Promise<void> {
    try {
      const prefixedItems = items.map(({ key, value }) => [
        this.getPrefixedKey(key),
        value,
      ]) as [string, string][];

      await AsyncStorage.multiSet(prefixedItems);
    } catch (error) {
      console.error('[Storage] Error setting multiple items:', error);
      throw error;
    }
  }

  /**
   * Remove multiple items
   */
  public async multiRemove(keys: string[]): Promise<void> {
    try {
      const prefixedKeys = keys.map((key) => this.getPrefixedKey(key));
      await AsyncStorage.multiRemove(prefixedKeys);
    } catch (error) {
      console.error('[Storage] Error removing multiple items:', error);
      throw error;
    }
  }

  /**
   * Get all keys
   */
  public async getAllKeys(): Promise<string[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return keys
        .filter((key) => key.startsWith(this.prefix))
        .map((key) => this.removePrefixFromKey(key));
    } catch (error) {
      console.error('[Storage] Error getting all keys:', error);
      return [];
    }
  }

  /**
   * Clear all storage
   */
  public async clear(): Promise<void> {
    try {
      const keys = await this.getAllKeys();
      await this.multiRemove(keys);
    } catch (error) {
      console.error('[Storage] Error clearing storage:', error);
      throw error;
    }
  }

  /**
   * Merge item (for objects)
   */
  public async mergeItem(key: string, value: string): Promise<void> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      await AsyncStorage.mergeItem(prefixedKey, value);
    } catch (error) {
      console.error('[Storage] Error merging item:', key, error);
      throw error;
    }
  }

  /**
   * Get object from storage
   */
  public async getObject<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.getItem(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      console.error('[Storage] Error getting object:', key, error);
      return null;
    }
  }

  /**
   * Set object in storage
   */
  public async setObject(key: string, value: any): Promise<void> {
    try {
      const jsonString = JSON.stringify(value);
      await this.setItem(key, jsonString);
    } catch (error) {
      console.error('[Storage] Error setting object:', key, error);
      throw error;
    }
  }

  /**
   * Check if key exists
   */
  public async hasKey(key: string): Promise<boolean> {
    try {
      const value = await this.getItem(key);
      return value !== null;
    } catch (error) {
      console.error('[Storage] Error checking key:', key, error);
      return false;
    }
  }

  /**
   * Get storage size (number of items)
   */
  public async getSize(): Promise<number> {
    try {
      const keys = await this.getAllKeys();
      return keys.length;
    } catch (error) {
      console.error('[Storage] Error getting size:', error);
      return 0;
    }
  }

  /**
   * Get prefixed key
   */
  private getPrefixedKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Remove prefix from key
   */
  private removePrefixFromKey(key: string): string {
    return key.startsWith(this.prefix) ? key.slice(this.prefix.length) : key;
  }
}
