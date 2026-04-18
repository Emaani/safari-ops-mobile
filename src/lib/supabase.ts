import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const SUPABASE_URL     = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[Supabase] Missing environment variables. Check your .env file.\n' +
    'Required: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(
  SUPABASE_URL  || '',
  SUPABASE_ANON_KEY || '',
  {
    auth: {
      storage:            AsyncStorage,
      autoRefreshToken:   true,
      persistSession:     true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// ─── AppState-driven auth token refresh ───────────────────────────────────────
// When the app returns to foreground, tell Supabase to refresh its auth token
// immediately rather than waiting for the next scheduled refresh. This keeps
// realtime subscriptions alive after the device wakes from sleep.
AppState.addEventListener('change', (nextState) => {
  if (nextState === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
