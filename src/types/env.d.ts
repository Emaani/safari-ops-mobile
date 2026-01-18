// Environment variable type declarations for Expo
// This allows TypeScript to recognize process.env without @types/node

export {};

declare global {
  // eslint-disable-next-line no-var
  var process: {
    env: {
      EXPO_PUBLIC_SUPABASE_URL?: string;
      EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
      EXPO_PUBLIC_PROJECT_ID?: string;
      NODE_ENV?: 'development' | 'production' | 'test';
      [key: string]: string | undefined;
    };
  };
}
