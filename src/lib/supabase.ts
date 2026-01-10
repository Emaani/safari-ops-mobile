import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ohlbioostgjxuwnaxjgk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obGJpb29zdGdqeHV3bmF4amdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMzQyMDYsImV4cCI6MjA3NjgxMDIwNn0.4ddXH1vsSebt6DI8wnQki_8fwQhxjxSsyfbDkqgN9Iw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
