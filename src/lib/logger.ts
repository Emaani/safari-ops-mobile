/**
 * Logger utility for Safari Ops Mobile
 *
 * In development mode (__DEV__ is true), logs are output to the console.
 * In production mode, logs are suppressed by default.
 *
 * Usage:
 *   import { logger } from '../lib/logger';
 *   logger.log('[Component]', 'Message');
 *   logger.warn('[Component]', 'Warning message');
 *   logger.error('[Component]', 'Error message');
 */

// Check if we're in development mode
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : (process as any).env?.NODE_ENV !== 'production';

interface LoggerConfig {
  enabled: boolean;
  prefix: string;
}

const defaultConfig: LoggerConfig = {
  enabled: isDev,
  prefix: '[SafariOps]',
};

let config = { ...defaultConfig };

/**
 * Configure the logger
 */
export function configureLogger(newConfig: Partial<LoggerConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Format log message with prefix and tag
 */
function formatMessage(tag: string, message: string): string {
  return `${config.prefix}${tag} ${message}`;
}

/**
 * Logger object with various log levels
 */
export const logger = {
  /**
   * Standard log - only in development
   */
  log: (tag: string, ...args: unknown[]): void => {
    if (config.enabled) {
      console.log(formatMessage(tag, ''), ...args);
    }
  },

  /**
   * Warning log - only in development
   */
  warn: (tag: string, ...args: unknown[]): void => {
    if (config.enabled) {
      console.warn(formatMessage(tag, ''), ...args);
    }
  },

  /**
   * Error log - always logged (even in production)
   * These are important for debugging issues
   */
  error: (tag: string, ...args: unknown[]): void => {
    console.error(formatMessage(tag, ''), ...args);
  },

  /**
   * Debug log - only in development with explicit debug flag
   */
  debug: (tag: string, ...args: unknown[]): void => {
    if (config.enabled && isDev) {
      console.debug(formatMessage(tag, ''), ...args);
    }
  },

  /**
   * Info log - only in development
   */
  info: (tag: string, ...args: unknown[]): void => {
    if (config.enabled) {
      console.info(formatMessage(tag, ''), ...args);
    }
  },

  /**
   * Performance timing log
   */
  time: (label: string): void => {
    if (config.enabled) {
      console.time(`${config.prefix} ${label}`);
    }
  },

  timeEnd: (label: string): void => {
    if (config.enabled) {
      console.timeEnd(`${config.prefix} ${label}`);
    }
  },

  /**
   * Group logs together
   */
  group: (label: string): void => {
    if (config.enabled) {
      console.group(`${config.prefix} ${label}`);
    }
  },

  groupEnd: (): void => {
    if (config.enabled) {
      console.groupEnd();
    }
  },

  /**
   * Check if logging is enabled
   */
  isEnabled: (): boolean => config.enabled,
};

// Also export a noop logger for when you want to completely disable logging
export const noopLogger = {
  log: (): void => {},
  warn: (): void => {},
  error: (): void => {},
  debug: (): void => {},
  info: (): void => {},
  time: (): void => {},
  timeEnd: (): void => {},
  group: (): void => {},
  groupEnd: (): void => {},
  isEnabled: (): boolean => false,
};

export default logger;
