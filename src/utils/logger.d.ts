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
export declare enum LogLevel {
    SILENT = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4
}
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
export {};
//# sourceMappingURL=logger.d.ts.map