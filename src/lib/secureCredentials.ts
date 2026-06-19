import * as SecureStore from 'expo-secure-store';

const KEY_EMAIL    = 'jackal:biometric_email';
const KEY_PASSWORD = 'jackal:biometric_password';

export async function saveCredentials(email: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_EMAIL,    email);
  await SecureStore.setItemAsync(KEY_PASSWORD, password);
}

export async function loadCredentials(): Promise<{ email: string; password: string } | null> {
  const [email, password] = await Promise.all([
    SecureStore.getItemAsync(KEY_EMAIL),
    SecureStore.getItemAsync(KEY_PASSWORD),
  ]);
  if (email && password) return { email, password };
  return null;
}

export async function clearCredentials(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_EMAIL),
    SecureStore.deleteItemAsync(KEY_PASSWORD),
  ]);
}
