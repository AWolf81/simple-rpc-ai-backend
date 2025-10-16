/**
 * Performance Timing Utility
 *
 * Centralized timing configuration and logging for debugging performance issues.
 * Controlled via server config or environment variable.
 */
/**
 * Initialize timing based on config and environment
 */
export declare function initializeTiming(config?: {
    enableTiming?: boolean;
}): void;
/**
 * Check if timing is enabled
 */
export declare function isTimingEnabled(): boolean;
/**
 * Log timing information (only if enabled)
 */
export declare function logTiming(message: string): void;
/**
 * Helper to format timing with tree structure
 */
export declare function formatTiming(label: string, time: number, total?: number, isLast?: boolean): string;
/**
 * Create a timing logger with context
 */
export declare class TimingLogger {
    private startTime;
    private context;
    private enabled;
    private depth;
    private indent;
    constructor(context: string);
    /**
     * Log a timing checkpoint
     */
    checkpoint(label: string, lastCheckpoint?: number): number;
    /**
     * Log final timing
     */
    end(label?: string): void;
    /**
     * Check if timing is enabled for this logger
     */
    isEnabled(): boolean;
}
//# sourceMappingURL=timing.d.ts.map