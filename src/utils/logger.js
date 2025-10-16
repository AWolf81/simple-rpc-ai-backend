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
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["SILENT"] = 0] = "SILENT";
    LogLevel[LogLevel["ERROR"] = 1] = "ERROR";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["INFO"] = 3] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 4] = "DEBUG";
})(LogLevel || (LogLevel = {}));
class Logger {
    level;
    constructor() {
        this.level = this.parseLogLevel(process.env.LOG_LEVEL);
    }
    parseLogLevel(level) {
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
    error(...args) {
        if (this.level >= LogLevel.ERROR) {
            console.error(...args);
        }
    }
    warn(...args) {
        if (this.level >= LogLevel.WARN) {
            console.warn(...args);
        }
    }
    info(...args) {
        if (this.level >= LogLevel.INFO) {
            console.log(...args);
        }
    }
    debug(...args) {
        if (this.level >= LogLevel.DEBUG) {
            console.log(...args);
        }
    }
    // Alias for verbose logging (same as debug)
    verbose(...args) {
        this.debug(...args);
    }
    // Convenience method for startup logs (always shown unless silent)
    startup(...args) {
        if (this.level > LogLevel.SILENT) {
            console.log(...args);
        }
    }
    setLevel(level) {
        this.level = level;
    }
    getLevel() {
        return this.level;
    }
}
// Export singleton instance
export const logger = new Logger();
//# sourceMappingURL=logger.js.map