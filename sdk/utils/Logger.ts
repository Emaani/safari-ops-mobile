/**
 * Logger Utility
 *
 * Centralized logging with log levels and formatting
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: Date;
}

export interface LoggerConfig {
  level?: LogLevel;
  enabled?: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export class Logger {
  private level: LogLevel;
  private enabled: boolean;
  private logs: LogEntry[] = [];

  constructor(config: LoggerConfig = {}) {
    this.level = config.level || 'info';
    this.enabled = config.enabled !== false;
  }

  /**
   * Log error message
   */
  public error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  /**
   * Log warning message
   */
  public warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  /**
   * Log info message
   */
  public info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  /**
   * Log debug message
   */
  public debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.enabled) return;

    if (LOG_LEVELS[level] <= LOG_LEVELS[this.level]) {
      const entry: LogEntry = {
        level,
        message,
        data,
        timestamp: new Date(),
      };

      this.logs.push(entry);

      // Console output
      const timestamp = entry.timestamp.toISOString();
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

      switch (level) {
        case 'error':
          console.error(prefix, message, data || '');
          break;
        case 'warn':
          console.warn(prefix, message, data || '');
          break;
        case 'info':
          console.log(prefix, message, data || '');
          break;
        case 'debug':
          console.debug(prefix, message, data || '');
          break;
      }
    }
  }

  /**
   * Get all logs
   */
  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  public clearLogs(): void {
    this.logs = [];
  }

  /**
   * Set log level
   */
  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Enable/disable logging
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}
