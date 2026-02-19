import { useCallback, useMemo, useRef, useState } from 'react';
import type { BoardObjectsRecord } from '../types/board';

const DEFAULT_MAX_HISTORY_ENTRIES = 100;

export interface BoardHistoryEntry {
  id: string;
  source: 'manual' | 'ai';
  createdAt: number;
  before: BoardObjectsRecord;
  after: BoardObjectsRecord;
}

export interface BoardHistoryTransition {
  direction: 'undo' | 'redo';
  entry: BoardHistoryEntry;
  from: BoardObjectsRecord;
  to: BoardObjectsRecord;
}

interface BoardHistoryOptions {
  maxEntries?: number;
}

interface BoardHistoryCommitInput {
  source: 'manual' | 'ai';
  before: BoardObjectsRecord;
  after: BoardObjectsRecord;
}

interface UseBoardHistoryResult {
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
  commit: (input: BoardHistoryCommitInput) => BoardHistoryEntry | null;
  undo: () => BoardHistoryTransition | null;
  redo: () => BoardHistoryTransition | null;
  reset: () => void;
}

function fallbackClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneBoardState(state: BoardObjectsRecord): BoardObjectsRecord {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(state);
  }
  return fallbackClone(state);
}

function createHistoryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `history-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function stableSortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stableSortValue(entry));
  }

  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    Object.keys(input)
      .sort((a, b) => a.localeCompare(b))
      .forEach((key) => {
        output[key] = stableSortValue(input[key]);
      });
    return output;
  }

  return value;
}

function boardStatesEqual(a: BoardObjectsRecord, b: BoardObjectsRecord): boolean {
  return JSON.stringify(stableSortValue(a)) === JSON.stringify(stableSortValue(b));
}

export function useBoardHistory(options: BoardHistoryOptions = {}): UseBoardHistoryResult {
  const maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_MAX_HISTORY_ENTRIES);
  const undoStackRef = useRef<BoardHistoryEntry[]>([]);
  const redoStackRef = useRef<BoardHistoryEntry[]>([]);
  const [stackDepths, setStackDepths] = useState({ undoDepth: 0, redoDepth: 0 });

  const syncStackDepths = useCallback(() => {
    setStackDepths({
      undoDepth: undoStackRef.current.length,
      redoDepth: redoStackRef.current.length,
    });
  }, []);

  const commit = useCallback(
    (input: BoardHistoryCommitInput): BoardHistoryEntry | null => {
      if (boardStatesEqual(input.before, input.after)) {
        return null;
      }

      const entry: BoardHistoryEntry = {
        id: createHistoryId(),
        source: input.source,
        createdAt: Date.now(),
        before: cloneBoardState(input.before),
        after: cloneBoardState(input.after),
      };

      undoStackRef.current.push(entry);
      if (undoStackRef.current.length > maxEntries) {
        undoStackRef.current = undoStackRef.current.slice(
          undoStackRef.current.length - maxEntries,
        );
      }
      redoStackRef.current = [];
      syncStackDepths();

      return entry;
    },
    [maxEntries, syncStackDepths],
  );

  const undo = useCallback((): BoardHistoryTransition | null => {
    const entry = undoStackRef.current.pop();
    if (!entry) {
      return null;
    }

    redoStackRef.current.push(entry);
    syncStackDepths();

    return {
      direction: 'undo',
      entry: {
        ...entry,
        before: cloneBoardState(entry.before),
        after: cloneBoardState(entry.after),
      },
      from: cloneBoardState(entry.after),
      to: cloneBoardState(entry.before),
    };
  }, [syncStackDepths]);

  const redo = useCallback((): BoardHistoryTransition | null => {
    const entry = redoStackRef.current.pop();
    if (!entry) {
      return null;
    }

    undoStackRef.current.push(entry);
    if (undoStackRef.current.length > maxEntries) {
      undoStackRef.current = undoStackRef.current.slice(
        undoStackRef.current.length - maxEntries,
      );
    }
    syncStackDepths();

    return {
      direction: 'redo',
      entry: {
        ...entry,
        before: cloneBoardState(entry.before),
        after: cloneBoardState(entry.after),
      },
      from: cloneBoardState(entry.before),
      to: cloneBoardState(entry.after),
    };
  }, [maxEntries, syncStackDepths]);

  const reset = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    syncStackDepths();
  }, [syncStackDepths]);

  return useMemo(
    () => ({
      canUndo: stackDepths.undoDepth > 0,
      canRedo: stackDepths.redoDepth > 0,
      undoDepth: stackDepths.undoDepth,
      redoDepth: stackDepths.redoDepth,
      commit,
      undo,
      redo,
      reset,
    }),
    [commit, redo, reset, stackDepths.redoDepth, stackDepths.undoDepth, undo],
  );
}
