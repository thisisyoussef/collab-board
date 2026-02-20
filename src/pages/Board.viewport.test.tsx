import { describe, expect, it, beforeEach } from 'vitest';
import {
  flushScheduledViewportSave,
  loadViewportState,
  saveViewportState,
  viewportStorageKey,
  clampViewportScale,
} from '../lib/viewport';

describe('Board viewport persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves and restores viewport by board and user context', () => {
    saveViewportState({
      boardId: 'board-123',
      userId: 'user-abc',
      viewport: {
        x: -220,
        y: 160,
        scale: 1.4,
      },
    });

    const restored = loadViewportState({ boardId: 'board-123', userId: 'user-abc' });
    expect(restored).toEqual({
      x: -220,
      y: 160,
      scale: 1.4,
    });
  });

  it('ignores invalid persisted viewport values', () => {
    window.localStorage.setItem(
      viewportStorageKey({ boardId: 'board-invalid', userId: null }),
      JSON.stringify({ x: 'bad', y: 4, scale: 1 }),
    );

    expect(loadViewportState({ boardId: 'board-invalid', userId: null })).toBeNull();
  });

  it('clamps viewport scale to supported zoom boundaries', () => {
    expect(clampViewportScale(0.01)).toBe(0.1);
    expect(clampViewportScale(8)).toBe(5);
    expect(clampViewportScale(1.2)).toBe(1.2);
  });

  it('flushes debounced viewport saves by clearing timer and saving now', () => {
    const clearTimeoutFn = vi.fn();
    const saveNow = vi.fn();

    const next = flushScheduledViewportSave({
      timeoutId: 42,
      clearTimeoutFn,
      saveNow,
    });

    expect(clearTimeoutFn).toHaveBeenCalledWith(42);
    expect(saveNow).toHaveBeenCalledTimes(1);
    expect(next).toBeNull();
  });

  it('still saves now when no timer exists', () => {
    const clearTimeoutFn = vi.fn();
    const saveNow = vi.fn();

    const next = flushScheduledViewportSave({
      timeoutId: null,
      clearTimeoutFn,
      saveNow,
    });

    expect(clearTimeoutFn).not.toHaveBeenCalled();
    expect(saveNow).toHaveBeenCalledTimes(1);
    expect(next).toBeNull();
  });
});
