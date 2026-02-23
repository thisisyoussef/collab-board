import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BoardObject, BoardObjectsRecord } from '../types/board';
import { useBoardHistory } from './useBoardHistory';

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
    updatedAt: '2026-02-19T00:00:00.000Z',
  };
}

function stateWith(...objects: BoardObject[]): BoardObjectsRecord {
  const record: BoardObjectsRecord = {};
  objects.forEach((object) => {
    record[object.id] = object;
  });
  return record;
}

describe('useBoardHistory', () => {
  it('pushes entries on commit, ignores no-ops, and caps history depth', () => {
    const { result } = renderHook(() => useBoardHistory({ maxEntries: 2 }));
    const s0 = stateWith();
    const s1 = stateWith(sticky('a', 'A'));
    const s2 = stateWith(sticky('a', 'A'), sticky('b', 'B'));
    const s3 = stateWith(sticky('a', 'A'), sticky('b', 'B'), sticky('c', 'C'));

    act(() => {
      result.current.commit({ source: 'manual', before: s0, after: s0 });
      result.current.commit({ source: 'manual', before: s0, after: s1 });
      result.current.commit({ source: 'manual', before: s1, after: s2 });
      result.current.commit({ source: 'manual', before: s2, after: s3 });
    });

    expect(result.current.undoDepth).toBe(2);
    expect(result.current.canUndo).toBe(true);

    let transition = null;
    act(() => {
      transition = result.current.undo();
    });

    expect(transition?.to).toEqual(s2);
    expect(result.current.undoDepth).toBe(1);
    expect(result.current.redoDepth).toBe(1);
  });

  it('undo/redo transitions move entries between stacks correctly', () => {
    const { result } = renderHook(() => useBoardHistory());
    const before = stateWith();
    const after = stateWith(sticky('a', 'First'));

    act(() => {
      result.current.commit({ source: 'manual', before, after });
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    let undoTransition = null;
    act(() => {
      undoTransition = result.current.undo();
    });

    expect(undoTransition?.direction).toBe('undo');
    expect(undoTransition?.to).toEqual(before);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    let redoTransition = null;
    act(() => {
      redoTransition = result.current.redo();
    });

    expect(redoTransition?.direction).toBe('redo');
    expect(redoTransition?.to).toEqual(after);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('clears redo stack when a new commit happens after undo', () => {
    const { result } = renderHook(() => useBoardHistory());
    const s0 = stateWith();
    const s1 = stateWith(sticky('a', 'A'));
    const s2 = stateWith(sticky('a', 'A'), sticky('b', 'B'));
    const s3 = stateWith(sticky('c', 'C'));

    act(() => {
      result.current.commit({ source: 'manual', before: s0, after: s1 });
      result.current.commit({ source: 'manual', before: s1, after: s2 });
    });

    act(() => {
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.commit({ source: 'manual', before: s1, after: s3 });
    });

    expect(result.current.canRedo).toBe(false);
    expect(result.current.redoDepth).toBe(0);
  });

  it('keeps committed snapshots immutable even if caller mutates original objects later', () => {
    const { result } = renderHook(() => useBoardHistory());
    const mutableBefore = stateWith();
    const mutableAfter = stateWith(sticky('a', 'Original'));

    act(() => {
      result.current.commit({
        source: 'ai',
        before: mutableBefore,
        after: mutableAfter,
      });
    });

    mutableAfter.a.text = 'Mutated';

    let undoTransition = null;
    let redoTransition = null;
    act(() => {
      undoTransition = result.current.undo();
      redoTransition = result.current.redo();
    });

    expect(undoTransition?.to).toEqual(stateWith());
    expect(redoTransition?.to.a.text).toBe('Original');
  });

  it('getEntries returns a copy of the undo stack', () => {
    const { result } = renderHook(() => useBoardHistory());
    const s0 = stateWith();
    const s1 = stateWith(sticky('a', 'A'));
    const s2 = stateWith(sticky('a', 'A'), sticky('b', 'B'));

    act(() => {
      result.current.commit({ source: 'manual', before: s0, after: s1 });
      result.current.commit({ source: 'ai', before: s1, after: s2 });
    });

    const entries = result.current.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].source).toBe('manual');
    expect(entries[0].after).toEqual(s1);
    expect(entries[1].source).toBe('ai');
    expect(entries[1].after).toEqual(s2);

    // Verify it's a copy — mutating returned array doesn't affect hook
    entries.length = 0;
    const entries2 = result.current.getEntries();
    expect(entries2).toHaveLength(2);
  });
});

