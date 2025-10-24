/**
 * History Manager - Persistent prompt history across sessions
 *
 * Stores recent prompts in a JSON file for up/down arrow navigation.
 * Best practices:
 * - Keep last 50 prompts (configurable)
 * - Store in user config directory (~/.simple-agent/history.json)
 * - Deduplicate consecutive identical prompts
 * - Rotate old entries when limit is reached
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.simple-agent');
const HISTORY_FILE = join(CONFIG_DIR, 'history.json');
const DEFAULT_MAX_HISTORY = 50;

export interface HistoryEntry {
  prompt: string;
  timestamp: number;
}

export interface HistoryData {
  entries: HistoryEntry[];
  version: number; // For future migrations
}

export class HistoryManager {
  private entries: HistoryEntry[] = [];
  private maxHistory: number;
  private filePath: string;

  constructor(maxHistory: number = DEFAULT_MAX_HISTORY, filePath?: string) {
    this.maxHistory = maxHistory;
    this.filePath = filePath || HISTORY_FILE;
    this.load();
  }

  /**
   * Load history from disk
   */
  private load(): void {
    try {
      if (existsSync(this.filePath)) {
        const content = readFileSync(this.filePath, 'utf-8');
        const data: HistoryData = JSON.parse(content);

        // Validate and load entries
        if (data.entries && Array.isArray(data.entries)) {
          this.entries = data.entries.slice(-this.maxHistory); // Keep only last N
        }
      }
    } catch (error) {
      // If history file is corrupted, start fresh
      console.warn('Failed to load history, starting fresh:', error instanceof Error ? error.message : error);
      this.entries = [];
    }
  }

  /**
   * Save history to disk
   */
  private save(): void {
    try {
      const data: HistoryData = {
        version: 1,
        entries: this.entries
      };

      writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save history:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Add a prompt to history
   * Deduplicates consecutive identical prompts
   */
  add(prompt: string): void {
    const trimmed = prompt.trim();
    if (!trimmed) {
      return; // Don't save empty prompts
    }

    // Don't save if identical to last prompt (deduplicate)
    const lastEntry = this.entries[this.entries.length - 1];
    if (lastEntry && lastEntry.prompt === trimmed) {
      return;
    }

    // Add new entry
    this.entries.push({
      prompt: trimmed,
      timestamp: Date.now()
    });

    // Rotate if exceeds max
    if (this.entries.length > this.maxHistory) {
      this.entries = this.entries.slice(-this.maxHistory);
    }

    // Save to disk
    this.save();
  }

  /**
   * Get all prompts (for up/down navigation)
   * Returns in chronological order (oldest first)
   */
  getAll(): string[] {
    return this.entries.map(e => e.prompt);
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.entries = [];
    this.save();
  }

  /**
   * Get history statistics
   */
  getStats() {
    return {
      count: this.entries.length,
      maxHistory: this.maxHistory,
      oldest: this.entries[0]?.timestamp,
      newest: this.entries[this.entries.length - 1]?.timestamp,
      filePath: this.filePath
    };
  }

  /**
   * Search history by text
   */
  search(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    return this.entries
      .filter(e => e.prompt.toLowerCase().includes(lowerQuery))
      .map(e => e.prompt);
  }
}

/**
 * Singleton instance for app-wide use
 */
let instance: HistoryManager | null = null;

export function getHistoryManager(maxHistory?: number): HistoryManager {
  if (!instance) {
    instance = new HistoryManager(maxHistory);
  }
  return instance;
}
