/**
 * Centralized logging utility with configurable log levels
 *
 * Respects LOG_LEVEL environment variable:
 * - 'silent': No logs
 * - 'error': Only errors
 * - 'warn': Errors and warnings
 * - 'info': Errors, warnings, and info (default for production)
 * - 'debug': All logs including debug messages (default for development)
 */

export enum LogLevel {
  SILENT = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4
}

class Logger {
  private level: LogLevel;

  constructor() {
    this.level = this.parseLogLevel(process.env.LOG_LEVEL);
  }

  private parseLogLevel(level?: string): LogLevel {
    if (!level) {
      // Default to INFO in production, DEBUG in development
      return process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    }

    switch (level.toLowerCase()) {
      case 'silent':
        return LogLevel.SILENT;
      case 'error':
        return LogLevel.ERROR;
      case 'warn':
      case 'warning':
        return LogLevel.WARN;
      case 'info':
        return LogLevel.INFO;
      case 'debug':
      case 'verbose':
        return LogLevel.DEBUG;
      default:
        console.warn(`Unknown LOG_LEVEL "${level}", defaulting to INFO`);
        return LogLevel.INFO;
    }
  }

  error(...args: any[]): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(...args);
    }
  }

  warn(...args: any[]): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(...args);
    }
  }

  info(...args: any[]): void {
    if (this.level >= LogLevel.INFO) {
      console.log(...args);
    }
  }

  debug(...args: any[]): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(...args);
    }
  }

  // Convenience method for startup logs (always shown unless silent)
  startup(...args: any[]): void {
    if (this.level > LogLevel.SILENT) {
      console.log(...args);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }
}

// Export singleton instance
export const logger = new Logger();
