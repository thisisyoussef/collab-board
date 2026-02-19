// --------------------------------------------------------------------------
// Global Logger — natural-language, AI-agent-friendly logging for CollabBoard
// --------------------------------------------------------------------------
//
// Usage:
//   import { logger } from '../lib/logger';
//   logger.info('SOCKET', `User '${name}' connected`, { socketId });
//   logger.error('FIRESTORE', `Board save failed: ${err.message}`, { boardId });
//
// Design:
//   • Singleton module — NOT a React context (works in hooks, event handlers,
//     async functions, Konva callbacks — everywhere).
//   • In-memory ring buffer (1000 entries) for the LogTerminal UI.
//   • Subscriber pattern for React integration via useSyncExternalStore.
//   • queueMicrotask batching — 100 rapid logs → 1 UI update.
//   • Debug short-circuit — logger.debug() is zero-cost when disabled.
// --------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogCategory =
  | 'AUTH'
  | 'SOCKET'
  | 'CANVAS'
  | 'FIRESTORE'
  | 'AI'
  | 'PRESENCE'
  | 'SYNC'
  | 'PERFORMANCE';

export interface LogEntry {
  /** Monotonically increasing counter (never resets during a session). */
  id: number;
  /** ISO 8601 timestamp: "2026-02-19T14:32:01.123Z" */
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  /** Human-readable natural-language description of what happened. */
  message: string;
  /** Structured data for machine parsing / AI-agent consumption. */
  context?: Record<string, unknown>;
}

export interface LoggerConfig {
  /** Ring buffer capacity (default 1000). */
  maxEntries: number;
  /** Whether DEBUG-level entries are captured (default: true in dev). */
  enableDebug: boolean;
  /** Mirror log entries to the browser console (default: true in dev). */
  enableConsole: boolean;
}

// --------------------------------------------------------------------------
// Ring Buffer — fixed-size circular array with O(1) push, O(n) toArray
// --------------------------------------------------------------------------

class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private count = 0;
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /** Return entries in chronological order (oldest → newest). */
  toArray(): T[] {
    if (this.count === 0) return [];
    const result: T[] = new Array(this.count);
    const start = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      result[i] = this.buffer[(start + i) % this.capacity] as T;
    }
    return result;
  }

  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.count = 0;
  }

  size(): number {
    return this.count;
  }
}

// --------------------------------------------------------------------------
// Logger Factory
// --------------------------------------------------------------------------

function createLogger(initialConfig: LoggerConfig) {
  const config = { ...initialConfig };
  const buffer = new RingBuffer<LogEntry>(config.maxEntries);
  let idCounter = 0;
  const listeners = new Set<() => void>();

  // ---- Microtask-based notification batching ----
  let notifyScheduled = false;
  function notifyListeners(): void {
    if (notifyScheduled) return;
    notifyScheduled = true;
    queueMicrotask(() => {
      notifyScheduled = false;
      for (const fn of listeners) {
        try {
          fn();
        } catch {
          // Listener errors must never break the logger.
        }
      }
    });
  }

  // ---- Core log function ----
  function log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    // Fast bail for debug when disabled — zero string formatting cost.
    if (level === 'debug' && !config.enableDebug) return;

    const entry: LogEntry = {
      id: ++idCounter,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      ...(context !== undefined && context !== null ? { context } : {}),
    };

    buffer.push(entry);

    // Mirror to browser console in dev
    if (config.enableConsole) {
      const consoleMethod =
        level === 'error'
          ? console.error
          : level === 'warn'
            ? console.warn
            : console.log;
      const prefix = `[${category}]`;
      if (context && Object.keys(context).length > 0) {
        consoleMethod(prefix, message, context);
      } else {
        consoleMethod(prefix, message);
      }
    }

    notifyListeners();
  }

  // ---- Snapshot for useSyncExternalStore ----
  // We cache the snapshot reference and only update it when the buffer changes.
  // This ensures React's useSyncExternalStore identity check works correctly.
  let snapshotCache: readonly LogEntry[] = [];
  let snapshotVersion = 0;

  function getSnapshot(): readonly LogEntry[] {
    const currentVersion = idCounter;
    if (currentVersion !== snapshotVersion) {
      snapshotCache = buffer.toArray();
      snapshotVersion = currentVersion;
    }
    return snapshotCache;
  }

  return {
    debug(category: LogCategory, message: string, context?: Record<string, unknown>): void {
      log('debug', category, message, context);
    },
    info(category: LogCategory, message: string, context?: Record<string, unknown>): void {
      log('info', category, message, context);
    },
    warn(category: LogCategory, message: string, context?: Record<string, unknown>): void {
      log('warn', category, message, context);
    },
    error(category: LogCategory, message: string, context?: Record<string, unknown>): void {
      log('error', category, message, context);
    },

    /** All entries in chronological order (oldest → newest). For LogTerminal. */
    getEntries(): readonly LogEntry[] {
      return getSnapshot();
    },

    /** Entries added after the given id. Useful for incremental reads. */
    getEntriesSince(sinceId: number): readonly LogEntry[] {
      return getSnapshot().filter((e) => e.id > sinceId);
    },

    /** Current number of entries stored. */
    getEntryCount(): number {
      return buffer.size();
    },

    /** Clear all stored entries. */
    clear(): void {
      buffer.clear();
      snapshotVersion = 0;
      snapshotCache = [];
      notifyListeners();
    },

    /**
     * Subscribe to log changes. Returns an unsubscribe function.
     * Designed for React's useSyncExternalStore:
     *   useSyncExternalStore(logger.subscribe, logger.getEntries)
     */
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Update config at runtime (e.g., enable debug from the LogTerminal). */
    setConfig(partial: Partial<LoggerConfig>): void {
      Object.assign(config, partial);
    },

    /** Read current config. */
    getConfig(): Readonly<LoggerConfig> {
      return { ...config };
    },

    /** Check if debug logging is enabled (for hot-path guards). */
    get isDebugEnabled(): boolean {
      return config.enableDebug;
    },
  };
}

// --------------------------------------------------------------------------
// Singleton Export
// --------------------------------------------------------------------------

const importMetaEnv =
  typeof import.meta !== 'undefined' && typeof import.meta.env === 'object'
    ? (import.meta.env as Record<string, unknown>)
    : undefined;

const isDev = importMetaEnv?.DEV === true;
const enableLogsFromEnv =
  String(importMetaEnv?.VITE_ENABLE_LOGS || '').toLowerCase() === 'true';

export const logger = createLogger({
  maxEntries: 1000,
  enableDebug: isDev,
  enableConsole: isDev || enableLogsFromEnv,
});

/** Re-export the return type for typing purposes. */
export type Logger = ReturnType<typeof createLogger>;
