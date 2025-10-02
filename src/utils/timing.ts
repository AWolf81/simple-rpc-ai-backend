/**
 * Performance Timing Utility
 *
 * Centralized timing configuration and logging for debugging performance issues.
 * Controlled via server config or environment variable.
 */

let timingEnabled = false;
let verboseLogsEnabled = false;

/**
 * Initialize timing based on config and environment
 */
export function initializeTiming(config?: { enableTiming?: boolean; enableVerboseLogs?: boolean }): void {
  // Environment variable takes precedence
  const envTiming = process.env.ENABLE_TIMING === 'true';
  const configTiming = config?.enableTiming ?? false;

  timingEnabled = envTiming || configTiming;

  const envVerbose = process.env.ENABLE_VERBOSE_LOGS === 'true';
  const configVerbose = config?.enableVerboseLogs ?? false;

  verboseLogsEnabled = envVerbose || configVerbose;

  if (timingEnabled) {
    console.log('⏱️  Performance timing enabled');
  }
  if (verboseLogsEnabled) {
    console.log('🔍 Verbose debug logs enabled');
  }
}

/**
 * Check if timing is enabled
 */
export function isTimingEnabled(): boolean {
  return timingEnabled;
}

/**
 * Check if verbose logs are enabled
 */
export function isVerboseLogsEnabled(): boolean {
  return verboseLogsEnabled;
}

/**
 * Log timing information (only if enabled)
 */
export function logTiming(message: string): void {
  if (timingEnabled) {
    console.log(message);
  }
}

/**
 * Log verbose debug information (only if enabled)
 */
export function logVerbose(message: string): void {
  if (verboseLogsEnabled) {
    console.log(message);
  }
}

/**
 * Helper to format timing with tree structure
 */
export function formatTiming(
  label: string,
  time: number,
  total?: number,
  isLast: boolean = false
): string {
  const prefix = isLast ? '└─' : '├─';
  const timeStr = time.toFixed(2);
  const totalStr = total ? ` (total: ${total.toFixed(2)}ms)` : '';

  return `[TIMING] ${prefix} ${label}: ${timeStr}ms${totalStr}`;
}

// Track nesting depth automatically
let nestingDepth = 0;

/**
 * Create a timing logger with context
 */
export class TimingLogger {
  private startTime: number;
  private context: string;
  private enabled: boolean;
  private depth: number;
  private indent: string;

  constructor(context: string) {
    this.context = context;
    this.startTime = performance.now();
    this.enabled = isTimingEnabled();
    this.depth = nestingDepth;
    this.indent = '  '.repeat(this.depth);

    // Increment nesting for child loggers
    nestingDepth++;

    if (this.enabled) {
      if (this.depth === 0) {
        // Top level - show absolute timestamp
        console.log(`${this.indent}[TIMING-${this.context}] ┌─ Started at ${new Date().toISOString()}`);
      } else {
        // Nested - no timestamp
        console.log(`${this.indent}[TIMING-${this.context}] ┌─ Started`);
      }
    }
  }

  /**
   * Log a timing checkpoint
   */
  checkpoint(label: string, lastCheckpoint?: number): number {
    const now = performance.now();

    if (this.enabled) {
      const elapsed = lastCheckpoint ? now - lastCheckpoint : now - this.startTime;
      const total = now - this.startTime;
      console.log(`${this.indent}[TIMING-${this.context}] ├─ ${label}: ${elapsed.toFixed(2)}ms (total: ${total.toFixed(2)}ms)`);
    }

    return now;
  }

  /**
   * Log final timing
   */
  end(label: string = 'Total time'): void {
    // Decrement nesting when this logger finishes
    nestingDepth--;

    if (this.enabled) {
      const total = performance.now() - this.startTime;
      console.log(`${this.indent}[TIMING-${this.context}] └─ ${label}: ${total.toFixed(2)}ms\n`);
    }
  }

  /**
   * Check if timing is enabled for this logger
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
