const isDev =
  typeof __DEV__ !== 'undefined'
    ? __DEV__
    : (process as { env?: Record<string, string | undefined> }).env?.NODE_ENV !== 'production';

const isVerboseLoggingEnabled =
  isDev &&
  (process as { env?: Record<string, string | undefined> }).env?.EXPO_PUBLIC_VERBOSE_LOGS === '1';

export function devLog(...args: unknown[]): void {
  if (isVerboseLoggingEnabled) {
    console.log(...args);
  }
}
