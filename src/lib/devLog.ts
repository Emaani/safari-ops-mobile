const isDev =
  typeof __DEV__ !== 'undefined'
    ? __DEV__
    : (process as { env?: Record<string, string | undefined> }).env?.NODE_ENV !== 'production';

const isVerboseLoggingEnabled =
  isDev &&
  (process as { env?: Record<string, string | undefined> }).env?.EXPO_PUBLIC_VERBOSE_LOGS === '1';

/** Verbose debug log — only emits when EXPO_PUBLIC_VERBOSE_LOGS=1 in dev builds */
export function devLog(...args: unknown[]): void {
  if (isVerboseLoggingEnabled) {
    console.log(...args);
  }
}

/** Errors always log in dev; in production builds they are suppressed to avoid leaking internals */
export function devError(message: string, ...args: unknown[]): void {
  if (isDev) {
    console.error(message, ...args);
  }
}

/**
 * Suppress noisy console.log spam in production by patching the global.
 * Called once at app start in production builds only.
 */
export function suppressProductionLogs(): void {
  if (!isDev) {
    // Keep console.error/warn for crash reporting; silence everything else
    console.log   = () => {};
    console.debug = () => {};
    console.info  = () => {};
  }
}
