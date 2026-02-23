import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardObjectsRecord } from '../types/board';
import type { BoardHistoryEntry } from './useBoardHistory';

export interface ReplayCheckpoint {
  id: string;
  atMs: number;
  source: 'manual' | 'ai';
  boardState: BoardObjectsRecord;
}

export interface UseSessionReplayOptions {
  getEntries: () => BoardHistoryEntry[];
  playIntervalMs?: number;
}

export interface UseSessionReplayResult {
  active: boolean;
  checkpoints: ReplayCheckpoint[];
  currentIndex: number;
  playing: boolean;
  currentBoardState: BoardObjectsRecord | null;
  enter: () => void;
  exit: () => void;
  goTo: (index: number) => void;
  play: () => void;
  pause: () => void;
  restore: () => BoardObjectsRecord | null;
}

const DEFAULT_PLAY_INTERVAL_MS = 500;

function deriveCheckpoints(entries: BoardHistoryEntry[]): ReplayCheckpoint[] {
  return entries.map((entry) => ({
    id: entry.id,
    atMs: entry.createdAt,
    source: entry.source,
    boardState: entry.after,
  }));
}

export function useSessionReplay(options: UseSessionReplayOptions): UseSessionReplayResult {
  const { getEntries, playIntervalMs = DEFAULT_PLAY_INTERVAL_MS } = options;

  const [active, setActive] = useState(false);
  const [checkpoints, setCheckpoints] = useState<ReplayCheckpoint[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkpointsRef = useRef<ReplayCheckpoint[]>([]);
  const currentIndexRef = useRef(0);

  // Keep refs in sync with state for interval callback
  useEffect(() => {
    checkpointsRef.current = checkpoints;
  }, [checkpoints]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const clearPlayInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const enter = useCallback(() => {
    const entries = getEntries();
    const derived = deriveCheckpoints(entries);
    setCheckpoints(derived);
    checkpointsRef.current = derived;
    const lastIndex = Math.max(0, derived.length - 1);
    setCurrentIndex(lastIndex);
    currentIndexRef.current = lastIndex;
    setActive(true);
    setPlaying(false);
    clearPlayInterval();
  }, [getEntries, clearPlayInterval]);

  const exit = useCallback(() => {
    clearPlayInterval();
    setPlaying(false);
    setActive(false);
    setCheckpoints([]);
    setCurrentIndex(0);
    checkpointsRef.current = [];
    currentIndexRef.current = 0;
  }, [clearPlayInterval]);

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, checkpointsRef.current.length - 1));
      setCurrentIndex(clamped);
      currentIndexRef.current = clamped;
    },
    [],
  );

  const play = useCallback(() => {
    setPlaying(true);
    clearPlayInterval();

    intervalRef.current = setInterval(() => {
      const nextIndex = currentIndexRef.current + 1;
      const maxIndex = checkpointsRef.current.length - 1;

      if (nextIndex > maxIndex) {
        // Reached the end — stop playing
        clearPlayInterval();
        setPlaying(false);
        return;
      }

      setCurrentIndex(nextIndex);
      currentIndexRef.current = nextIndex;

      // If we just advanced to the last checkpoint, stop
      if (nextIndex >= maxIndex) {
        clearPlayInterval();
        setPlaying(false);
      }
    }, playIntervalMs);
  }, [playIntervalMs, clearPlayInterval]);

  const pause = useCallback(() => {
    clearPlayInterval();
    setPlaying(false);
  }, [clearPlayInterval]);

  const restore = useCallback((): BoardObjectsRecord | null => {
    if (!checkpointsRef.current.length) {
      return null;
    }

    const checkpoint = checkpointsRef.current[currentIndexRef.current];
    if (!checkpoint) {
      return null;
    }

    const state = checkpoint.boardState;

    // Exit replay mode
    clearPlayInterval();
    setPlaying(false);
    setActive(false);
    setCheckpoints([]);
    setCurrentIndex(0);
    checkpointsRef.current = [];
    currentIndexRef.current = 0;

    return state;
  }, [clearPlayInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPlayInterval();
    };
  }, [clearPlayInterval]);

  const currentBoardState =
    active && checkpoints.length > 0 && checkpoints[currentIndex]
      ? checkpoints[currentIndex].boardState
      : null;

  return {
    active,
    checkpoints,
    currentIndex,
    playing,
    currentBoardState,
    enter,
    exit,
    goTo,
    play,
    pause,
    restore,
  };
}
