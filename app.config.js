// app.config.js — dynamic config so EXPO_PUBLIC_* vars are embedded at EAS build time
// even when .env is not committed to the repo.
//
// These are PUBLIC (anon) keys — safe to embed in the bundle.
// The Supabase anon key enforces Row-Level Security; it is not a secret.

const SUPABASE_URL     = process.env.EXPO_PUBLIC_SUPABASE_URL     || 'https://ohlbioostgjxuwnaxjgk.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obGJpb29zdGdqeHV3bmF4amdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMzQyMDYsImV4cCI6MjA3NjgxMDIwNn0.4ddXH1vsSebt6DI8wnQki_8fwQhxjxSsyfbDkqgN9Iw';
const PROJECT_ID       = process.env.EXPO_PUBLIC_PROJECT_ID        || 'e5636e2d-1c32-44b8-b5ec-0d03b65d0f5c';

export default {
  expo: {
    name: 'Jackal Adventures',
    slug: 'safari-ops-mobile',
    version: '1.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    notification: {
      color: '#1e40af',
      androidMode: 'default',
      androidCollapsedTitle: 'Jackal Adventures',
    },
    ios: {
      supportsTablet: true,
      buildNumber: '10',
      bundleIdentifier: 'com.jackalwild.jackaladventures',
      infoPlist: {
        UIBackgroundModes: ['remote-notification'],
        ITSAppUsesNonExemptEncryption: false,
        NSFaceIDUsageDescription:
          'Jackal Adventures uses Face ID so you can sign in quickly and securely without typing your password.',
        CFBundleAllowMixedLocalizations: true,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.jackalwild.jackaladventures',
      permissions: ['RECEIVE_BOOT_COMPLETED', 'VIBRATE', 'POST_NOTIFICATIONS'],
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      useNextNotificationsApi: true,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        'expo-local-authentication',
        {
          faceIDPermission:
            'Allow Jackal Adventures to use Face ID for quick and secure sign-in.',
        },
      ],
      [
        'expo-notifications',
        {
          color: '#1e40af',
          defaultChannel: 'default',
        },
      ],
      '@react-native-community/datetimepicker',
    ],
    extra: {
      // Embedded at build time — available via expo-constants in the bundle
      supabaseUrl:     SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
      projectId:       PROJECT_ID,
      eas: {
        projectId: PROJECT_ID,
      },
    },
    owner: 'jackal-adventures',
  },
};
