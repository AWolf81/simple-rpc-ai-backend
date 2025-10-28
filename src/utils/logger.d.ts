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
export declare enum LogLevel {
    SILENT = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4
}
export declare function setLogFilePath(filePath?: string | null): void;
declare class Logger {
    private level;
    constructor();
    private parseLogLevel;
    error(...args: any[]): void;
    warn(...args: any[]): void;
    info(...args: any[]): void;
    debug(...args: any[]): void;
    verbose(...args: any[]): void;
    startup(...args: any[]): void;
    setLevel(level: LogLevel): void;
    getLevel(): LogLevel;
}
export declare const logger: Logger;
export declare const getLogHistory: () => string[];
export declare const subscribeToLogs: (listener: (line: string) => void) => (() => void);
export declare const clearLogHistory: () => void;
export {};
