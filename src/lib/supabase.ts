import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Configuration
 *
 * Environment variables are loaded from .env file via Expo.
 * These use the EXPO_PUBLIC_ prefix to be accessible in the client bundle.
 *
 * To configure:
 * 1. Copy .env.example to .env
 * 2. Replace with your Supabase project credentials from https://supabase.com/dashboard
 */

// Environment variables - Expo loads EXPO_PUBLIC_* vars automatically
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[Supabase] Missing environment variables. Please check your .env file.\n' +
    'Required: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(
  SUPABASE_URL || '',
  SUPABASE_ANON_KEY || '',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
