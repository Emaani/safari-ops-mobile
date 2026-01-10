import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

/**
 * Clear Session Utility
 *
 * Use this utility to completely clear authentication state for testing purposes.
 * This is helpful when you want to test the login flow from a fresh state.
 *
 * Usage:
 * ```typescript
 * import { clearAllAuthData } from './utils/clearSession';
 *
 * // Call this to clear all auth data
 * await clearAllAuthData();
 * ```
 */

/**
 * Clear all authentication data from AsyncStorage and Supabase
 *
 * This function:
 * 1. Signs out from Supabase (clears server session)
 * 2. Clears all AsyncStorage keys (removes local session)
 * 3. Logs the result
 *
 * @returns Promise<void>
 */
export async function clearAllAuthData(): Promise<void> {
  console.log('[ClearSession] Starting to clear all auth data...');

  try {
    // Step 1: Sign out from Supabase
    console.log('[ClearSession] Signing out from Supabase...');
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      console.warn('[ClearSession] Supabase sign out error:', signOutError);
    } else {
      console.log('[ClearSession] ✓ Signed out from Supabase');
    }

    // Step 2: Clear AsyncStorage
    console.log('[ClearSession] Clearing AsyncStorage...');

    // Get all keys
    const keys = await AsyncStorage.getAllKeys();
    console.log('[ClearSession] Found keys in AsyncStorage:', keys);

    // Clear all keys
    if (keys.length > 0) {
      await AsyncStorage.multiRemove(keys);
      console.log('[ClearSession] ✓ Cleared all AsyncStorage keys');
    } else {
      console.log('[ClearSession] No keys found in AsyncStorage');
    }

    // Step 3: Verify everything is cleared
    const remainingKeys = await AsyncStorage.getAllKeys();
    if (remainingKeys.length === 0) {
      console.log('[ClearSession] ✅ SUCCESS: All auth data cleared!');
      console.log('[ClearSession] You should now see the Login screen on next app reload');
    } else {
      console.warn('[ClearSession] ⚠️ WARNING: Some keys still remain:', remainingKeys);
    }

  } catch (error) {
    console.error('[ClearSession] ❌ ERROR: Failed to clear auth data:', error);
    throw error;
  }
}

/**
 * View current session data (for debugging)
 *
 * This function shows what's currently stored in AsyncStorage
 * and the current Supabase session.
 *
 * @returns Promise<void>
 */
export async function viewSessionData(): Promise<void> {
  console.log('[ClearSession] ========== SESSION DATA ==========');

  try {
    // Check Supabase session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('[ClearSession] Error getting Supabase session:', error);
    } else if (session) {
      console.log('[ClearSession] Supabase session found:');
      console.log('[ClearSession] - User ID:', session.user.id);
      console.log('[ClearSession] - Email:', session.user.email);
      console.log('[ClearSession] - Expires at:', new Date(session.expires_at! * 1000).toLocaleString());
    } else {
      console.log('[ClearSession] No Supabase session found');
    }

    // Check AsyncStorage
    const keys = await AsyncStorage.getAllKeys();
    console.log('[ClearSession] AsyncStorage keys:', keys.length);

    if (keys.length > 0) {
      console.log('[ClearSession] Keys:', keys);

      // Show values for auth-related keys
      const authKeys = keys.filter(key =>
        key.includes('supabase') ||
        key.includes('auth') ||
        key.includes('session')
      );

      if (authKeys.length > 0) {
        console.log('[ClearSession] Auth-related keys:');
        for (const key of authKeys) {
          const value = await AsyncStorage.getItem(key);
          console.log(`[ClearSession] - ${key}:`, value ? 'HAS VALUE' : 'NULL');
        }
      }
    }

  } catch (error) {
    console.error('[ClearSession] Error viewing session data:', error);
  }

  console.log('[ClearSession] =====================================');
}
