import { JackalSDK } from './sdk';

export const initializeSDK = async () => {
  const sdk = JackalSDK.initialize({
    supabase: {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL!,
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    },
    eas: {
      projectId: 'e5636e2d-1c32-44b8-b5ec-0d03b65d0f5c',
    },
  });

  await sdk.start();

  return sdk;
};