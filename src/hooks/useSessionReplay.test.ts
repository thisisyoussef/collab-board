import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardObject, BoardObjectsRecord } from '../types/board';
import type { BoardHistoryEntry } from './useBoardHistory';
import { useSessionReplay } from './useSessionReplay';

/* ────── helpers ────── */

function sticky(id: string, text: string): BoardObject {
  return {
    id,
    type: 'sticky',
    x: 100,
    y: 120,
    width: 180,
    height: 120,
    rotation: 0,
    text,
    color: '#ffeb3b',
    zIndex: 1,
    createdBy: 'user-1',
    updatedAt: '2026-02-22T00:00:00.000Z',
  };
}

function stateWith(...objects: BoardObject[]): BoardObjectsRecord {
  const record: BoardObjectsRecord = {};
  objects.forEach((obj) => {
    record[obj.id] = obj;
  });
  return record;
}

function makeEntry(
  source: 'manual' | 'ai',
  before: BoardObjectsRecord,
  after: BoardObjectsRecord,
  createdAt = Date.now(),
): BoardHistoryEntry {
  return {
    id: `entry-${Math.random().toString(16).slice(2, 8)}`,
    source,
    createdAt,
    before,
    after,
  };
}

/* ────── tests ────── */

describe('useSessionReplay', () => {
  /* ── Deriving checkpoints ── */

  describe('deriving checkpoints from history entries', () => {
    it('returns empty checkpoints when history has no entries', () => {
      const getEntries = vi.fn().mockReturnValue([]);
      const { result } = renderHook(() => useSessionReplay({ getEntries }));

      act(() => {
        result.current.enter();
      });

      expect(result.current.checkpoints).toEqual([]);
    });

    it('derives one checkpoint per history entry using the after snapshot', () => {
      const s0 = stateWith();
      const s1 = stateWith(sticky('a', 'A'));
      const s2 = stateWith(sticky('a', 'A'), sticky('b', 'B'));
      const s3 = stateWith(sticky('a', 'A'), sticky('b', 'B'), sticky('c', 'C'));

      const entries = [
        makeEntry('manual', s0, s1, 1000),
        makeEntry('manual', s1, s2, 2000),
        makeEntry('ai', s2, s3, 3000),
      ];
      const getEntries = vi.fn().mockReturnValue(entries);
      const { result } = renderHook(() => useSessionReplay({ getEntries }));

      act(() => {
        result.current.enter();
      });

      expect(result.current.checkpoints).toHaveLength(3);
      expect(result.current.checkpoints[0].boardState).toEqual(s1);
      expect(result.current.checkpoints[1].boardState).toEqual(s2);
      expect(result.current.checkpoints[2].boardState).toEqual(s3);
      expect(result.current.checkpoints[0].atMs).toBe(1000);
      expect(result.current.checkpoints[1].atMs).toBe(2000);
      expect(result.current.checkpoints[2].atMs).toBe(3000);
    });

    it('preserves source field from history entries', () => {
      const s0 = stateWith();
      const s1 = stateWith(sticky('a', 'A'));
      const s2 = stateWith(sticky('b', 'B'));

      const entries = [
        makeEntry('manual', s0, s1, 1000),
        makeEntry('ai', s1, s2, 2000),
      ];
      const getEntries = vi.fn().mockReturnValue(entries);
      const { result } = renderHook(() => useSessionReplay({ getEntries }));

      act(() => {
        result.current.enter();
      });

      expect(result.current.checkpoints[0].source).toBe('manual');
      expect(result.current.checkpoints[1].source).toBe('ai');
    });
  });

  /* ── State management ── */

  describe('replay state management', () => {
    it('starts inactive with no checkpoints', () => {
      const getEntries = vi.fn().mockReturnValue([]);
      const { result } = renderHook(() => useSessionReplay({ getEntries }));

      expect(result.current.active).toBe(false);
      expect(result.current.checkpoints).toEqual([]);
      expect(result.current.currentIndex).toBe(0);
      expect(result.current.playing).toBe(false);
    });

    it('enter() activates replay and sets currentIndex to last checkpoint', () => {
      const s0 = stateWith();
      const s1 = stateWith(sticky('a', 'A'));
      const s2 = stateWith(sticky('b', 'B'));
      const entries = [
        makeEntry('manual', s0, s1, 1000),
        makeEntry('manual', s1, s2, 2000),
      ];
      const getEntries = vi.fn().mockReturnValue(entries);
      const { result } = renderHook(() => useSessionReplay({ getEntries }));

      act(() => {
        result.current.enter();
      });

      expect(result.current.active).toBe(true);
      expect(result.current.checkpoints).toHaveLength(2);
      expect(result.current.currentIndex).toBe(1); // last index
    });

    it('exit() deactivates replay and clears checkpoints', () => {
      const s0 = stateWith();
      const s1 = stateWith(sticky('a', 'A'));
      const entries = [makeEntry('manual', s0, s1, 1000)];
      const getEntries = vi.fn().mockReturnValue(entries);
      const { result } = renderHook(() => useSessionReplay({ getEntries }));

      act(() => {
        result.current.enter();
      });
      expect(result.current.active).toBe(true);

      act(() => {
        result.current.exit();
      });

      expect(result.current.active).toBe(false);
      expect(result.current.checkpoints).toEqual([]);
    });

    it('goTo(index) clamps to valid range and updates currentIndex', () => {
      const s0 = stateWith();
      const s1 = stateWith(sticky('a', 'A'));
      const s2 = stateWith(sticky('b', 'B'));
      const s3 = stateWith(sticky('c', 'C'));
      const entries = [
        makeEntry('manual', s0, s1, 1000),
        makeEntry('manual', s1, s2, 2000),
        makeEntry('manual', s2, s3, 3000),
      ];
      const getEntries = vi.fn().mockReturnValue(entries);
      const { result } = renderHook(() => useSessionReplay({ getEntries }));

      act(() => {
        result.current.enter();
      });

      act(() => {
        result.current.goTo(0);
      });
      expect(result.current.currentIndex).toBe(0);

      act(() => {
        result.current.goTo(-1);
      });
      expect(result.current.currentIndex).toBe(0); // clamped

      act(() => {
        result.current.goTo(999);
      });
      expect(result.current.currentIndex).toBe(2); // clamped to last
    });

    it('currentBoardState returns the boardState at currentIndex', () => {
      const s0 = stateWith();
      const s1 = stateWith(sticky('a', 'A'));
      const s2 = stateWith(sticky('b', 'B'));
      const entries = [
        makeEntry('manual', s0, s1, 1000),
        makeEntry('manual', s1, s2, 2000),
      ];
      const getEntries = vi.fn().mockReturnValue(entries);
      const { result } = renderHook(() => useSessionReplay({ getEntries }));

      act(() => {
        result.current.enter();
      });

      // currentIndex starts at last (1)
      expect(result.current.currentBoardState).toEqual(s2);

      act(() => {
        result.current.goTo(0);
      });
      expect(result.current.currentBoardState).toEqual(s1);
    });
  });

  /* ── Playback controls ── */

  describe('playback controls', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('play() sets playing to true', () => {
      const s0 = stateWith();
      const s1 = stateWith(sticky('a', 'A'));
      const entries = [makeEntry('manual', s0, s1, 1000)];
      const getEntries = vi.fn().mockReturnValue(entries);
      const { result } = renderHook(() =>
        useSessionReplay({ getEntries, playIntervalMs: 500 }),
      );

      act(() => {
        result.current.enter();
        result.current.play();
      });

      expect(result.current.playing).toBe(true);
    });

    it('pause() sets playing to false', () => {
      const s0 = stateWith();
      const s1 = stateWith(sticky('a', 'A'));
      const s2 = stateWith(sticky('b', 'B'));
      const entries = [
        makeEntry('manual', s0, s1, 1000),
        makeEntry('manual', s1, s2, 2000),
      ];
      const getEntries = vi.fn().mockReturnValue(entries);
      const { result } = renderHook(() =>
        useSessionReplay({ getEntries, playIntervalMs: 500 }),
      );

      act(() => {
        result.current.enter();
        result.current.goTo(0);
        result.current.play();
      });
      expect(result.current.playing).toBe(true);

      act(() => {
        result.current.pause();
      });
      expect(result.current.playing).toBe(false);
    });

    it('play() auto-advances currentIndex on interval and stops at end', () => {
      const s0 = stateWith();
      const s1 = stateWith(sticky('a', 'A'));
      const s2 = stateWith(sticky('b', 'B'));
      const s3 = stateWith(sticky('c', 'C'));
      const entries = [
        makeEntry('manual', s0, s1, 1000),
        makeEntry('manual', s1, s2, 2000),
        makeEntry('manual', s2, s3, 3000),
      ];
      const getEntries = vi.fn().mockReturnValue(entries);
      const { result } = renderHook(() =>
        useSessionReplay({ getEntries, playIntervalMs: 500 }),
      );

      act(() => {
        result.current.enter();
        result.current.goTo(0);
        result.current.play();
      });

      expect(result.current.currentIndex).toBe(0);

      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(result.current.currentIndex).toBe(1);

      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(result.current.currentIndex).toBe(2);
      expect(result.current.playing).toBe(false); // stopped at end
    });

    it('exit() during playback stops playing and deactivates', () => {
      const s0 = stateWith();
      const s1 = stateWith(sticky('a', 'A'));
      const s2 = stateWith(sticky('b', 'B'));
      const entries = [
        makeEntry('manual', s0, s1, 1000),
        makeEntry('manual', s1, s2, 2000),
      ];
      const getEntries = vi.fn().mockReturnValue(entries);
      const { result } = renderHook(() =>
        useSessionReplay({ getEntries, playIntervalMs: 500 }),
      );

      act(() => {
        result.current.enter();
        result.current.goTo(0);
        result.current.play();
      });
      expect(result.current.playing).toBe(true);

      act(() => {
        result.current.exit();
      });
      expect(result.current.playing).toBe(false);
      expect(result.current.active).toBe(false);
    });
  });

  /* ── Restore flow ── */

  describe('restore flow', () => {
    it('restore() returns the currentBoardState and exits replay', () => {
      const s0 = stateWith();
      const s1 = stateWith(sticky('a', 'A'));
      const s2 = stateWith(sticky('b', 'B'));
      const entries = [
        makeEntry('manual', s0, s1, 1000),
        makeEntry('manual', s1, s2, 2000),
      ];
      const getEntries = vi.fn().mockReturnValue(entries);
      const { result } = renderHook(() => useSessionReplay({ getEntries }));

      act(() => {
        result.current.enter();
        result.current.goTo(0);
      });

      let restored: BoardObjectsRecord | null = null;
      act(() => {
        restored = result.current.restore();
      });

      expect(restored).toEqual(s1);
      expect(result.current.active).toBe(false);
    });

    it('restore() when not active returns null', () => {
      const getEntries = vi.fn().mockReturnValue([]);
      const { result } = renderHook(() => useSessionReplay({ getEntries }));

      let restored: BoardObjectsRecord | null = null;
      act(() => {
        restored = result.current.restore();
      });

      expect(restored).toBeNull();
    });
  });
});
