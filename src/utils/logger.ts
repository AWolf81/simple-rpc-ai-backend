/**
 * Centralized logging utility with configurable log levels
 *
 * Respects LOG_LEVEL environment variable:
 * - 'silent': No logs
 * - 'error': Only errors
 * - 'warn': Errors and warnings
 * - 'info': Errors, warnings, and info (default for production)
 * - 'debug': All logs including debug messages (default for development)
 *
 * Optionally, logs can also be mirrored to a file by calling setLogFilePath()
 * or setting the LOG_FILE_PATH environment variable before importing this module.
 */

import fs from 'fs';
import path from 'path';
import util from 'util';

export enum LogLevel {
  SILENT = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4
}

let logStream: fs.WriteStream | null = null;
const logListeners = new Set<(line: string) => void>();
const LOG_HISTORY_LIMIT = 200;
const logHistory: string[] = [];

const formatArgs = (args: any[]): string => {
  return args
    .map(arg => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.stack || arg.message;
      return util.inspect(arg, { depth: 5, colors: false });
    })
    .join(' ');
};

const writeToFile = (level: string, args: any[]) => {
  if (!logStream) return;

  const timestamp = new Date().toISOString();
  try {
    logStream.write(`[${timestamp}] [${level}] ${formatArgs(args)}\n`);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
};

const appendHistory = (level: string, args: any[]) => {
  const line = `[${new Date().toISOString()}] [${level}] ${formatArgs(args)}`;
  logHistory.push(line);
  if (logHistory.length > LOG_HISTORY_LIMIT) {
    logHistory.splice(0, logHistory.length - LOG_HISTORY_LIMIT);
  }
  for (const listener of logListeners) {
    try {
      listener(line);
    } catch (error) {
      console.error('Log listener failed:', error);
    }
  }
};

export function setLogFilePath(filePath?: string | null): void {
  if (logStream) {
    logStream.end();
    logStream = null;
  }

  if (!filePath) return;

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    logStream = fs.createWriteStream(filePath, { flags: 'a' });
  } catch (error) {
    console.error(`Failed to open log file at ${filePath}:`, error);
    logStream = null;
  }
}

class Logger {
  private level: LogLevel;

  constructor() {
    this.level = this.parseLogLevel(process.env.LOG_LEVEL);
  }

  private parseLogLevel(level?: string): LogLevel {
    if (!level) {
      // Default to WARN for minimal noise (use LOG_LEVEL=info or LOG_LEVEL=debug for more verbose output)
      return LogLevel.WARN;
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
      appendHistory('ERROR', args);
      writeToFile('ERROR', args);
    }
  }

  warn(...args: any[]): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(...args);
      appendHistory('WARN', args);
      writeToFile('WARN', args);
    }
  }

  info(...args: any[]): void {
    if (this.level >= LogLevel.INFO) {
      console.log(...args);
      appendHistory('INFO', args);
      writeToFile('INFO', args);
    }
  }

  debug(...args: any[]): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(...args);
      appendHistory('DEBUG', args);
      writeToFile('DEBUG', args);
    }
  }

  // Alias for verbose logging (same as debug)
  verbose(...args: any[]): void {
    this.debug(...args);
  }

  // Convenience method for startup logs (always shown unless silent)
  startup(...args: any[]): void {
    if (this.level > LogLevel.SILENT) {
      console.log(...args);
      appendHistory('STARTUP', args);
      writeToFile('STARTUP', args);
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

// Configure file logging via environment variable if provided
if (process.env.LOG_FILE_PATH) {
  setLogFilePath(process.env.LOG_FILE_PATH);
}

export const getLogHistory = (): string[] => [...logHistory];

export const subscribeToLogs = (listener: (line: string) => void): (() => void) => {
  logListeners.add(listener);
  return () => {
    logListeners.delete(listener);
  };
};

export const clearLogHistory = (): void => {
  logHistory.length = 0;
};
