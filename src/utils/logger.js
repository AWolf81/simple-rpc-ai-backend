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
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["SILENT"] = 0] = "SILENT";
    LogLevel[LogLevel["ERROR"] = 1] = "ERROR";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["INFO"] = 3] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 4] = "DEBUG";
})(LogLevel || (LogLevel = {}));
let logStream = null;
const logListeners = new Set();
const LOG_HISTORY_LIMIT = 200;
const logHistory = [];
const formatArgs = (args) => {
    return args
        .map(arg => {
        if (typeof arg === 'string')
            return arg;
        if (arg instanceof Error)
            return arg.stack || arg.message;
        return util.inspect(arg, { depth: 5, colors: false });
    })
        .join(' ');
};
const writeToFile = (level, args) => {
    if (!logStream)
        return;
    const timestamp = new Date().toISOString();
    try {
        logStream.write(`[${timestamp}] [${level}] ${formatArgs(args)}\n`);
    }
    catch (error) {
        console.error('Failed to write to log file:', error);
    }
};
const appendHistory = (level, args) => {
    const line = `[${new Date().toISOString()}] [${level}] ${formatArgs(args)}`;
    logHistory.push(line);
    if (logHistory.length > LOG_HISTORY_LIMIT) {
        logHistory.splice(0, logHistory.length - LOG_HISTORY_LIMIT);
    }
    for (const listener of logListeners) {
        try {
            listener(line);
        }
        catch (error) {
            console.error('Log listener failed:', error);
        }
    }
};
export function setLogFilePath(filePath) {
    if (logStream) {
        logStream.end();
        logStream = null;
    }
    if (!filePath)
        return;
    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        logStream = fs.createWriteStream(filePath, { flags: 'a' });
    }
    catch (error) {
        console.error(`Failed to open log file at ${filePath}:`, error);
        logStream = null;
    }
}
class Logger {
    level;
    constructor() {
        this.level = this.parseLogLevel(process.env.LOG_LEVEL);
    }
    parseLogLevel(level) {
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
    error(...args) {
        if (this.level >= LogLevel.ERROR) {
            console.error(...args);
            appendHistory('ERROR', args);
            writeToFile('ERROR', args);
        }
    }
    warn(...args) {
        if (this.level >= LogLevel.WARN) {
            console.warn(...args);
            appendHistory('WARN', args);
            writeToFile('WARN', args);
        }
    }
    info(...args) {
        if (this.level >= LogLevel.INFO) {
            console.log(...args);
            appendHistory('INFO', args);
            writeToFile('INFO', args);
        }
    }
    debug(...args) {
        if (this.level >= LogLevel.DEBUG) {
            console.log(...args);
            appendHistory('DEBUG', args);
            writeToFile('DEBUG', args);
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
            appendHistory('STARTUP', args);
            writeToFile('STARTUP', args);
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
// Configure file logging via environment variable if provided
if (process.env.LOG_FILE_PATH) {
    setLogFilePath(process.env.LOG_FILE_PATH);
}
export const getLogHistory = () => [...logHistory];
export const subscribeToLogs = (listener) => {
    logListeners.add(listener);
    return () => {
        logListeners.delete(listener);
    };
};
export const clearLogHistory = () => {
    logHistory.length = 0;
};
