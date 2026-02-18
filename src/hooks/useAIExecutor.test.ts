import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAIExecutor, type AICommitMeta } from './useAIExecutor';
import type { AIActionPreview } from '../types/ai';
import type { BoardObjectsRecord } from '../types/board';

function preview(name: string, input: Record<string, unknown>): AIActionPreview {
  return {
    id: `${name}-id`,
    name,
    summary: '',
    input,
  };
}

describe('useAIExecutor', () => {
  it('applies a preview plan and supports single-step undo', async () => {
    let boardState: BoardObjectsRecord = {};
    const commits: AICommitMeta[] = [];

    const { result } = renderHook(() =>
      useAIExecutor({
        actorUserId: 'u-exec',
        getBoardState: () => boardState,
        commitBoardState: (next, meta) => {
          boardState = next;
          commits.push(meta);
        },
      }),
    );

    const previews = [
      preview('createStickyNote', {
        objectId: 'sticky-1',
        text: 'Plan',
        x: 140,
        y: 160,
      }),
    ];

    await act(async () => {
      const applied = await result.current.applyPreviewActions(previews, 'Prepared 1 action.');
      expect(applied).toBe(true);
    });

    expect(Object.keys(boardState)).toEqual(['sticky-1']);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.message).toContain('Applied 1 AI action');
    expect(commits).toHaveLength(1);
    expect(commits[0]?.source).toBe('ai');
    expect(commits[0]?.diff.createdIds).toEqual(['sticky-1']);

    await act(async () => {
      const undone = await result.current.undoLast();
      expect(undone).toBe(true);
    });

    expect(Object.keys(boardState)).toEqual([]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.message).toBe('Undid last AI apply.');
    expect(commits).toHaveLength(2);
    expect(commits[1]?.source).toBe('undo');
    expect(commits[1]?.diff.deletedIds).toEqual(['sticky-1']);
  });

  it('reports execution failures and does not commit invalid plans', async () => {
    let boardState: BoardObjectsRecord = {};
    const commits: AICommitMeta[] = [];

    const { result } = renderHook(() =>
      useAIExecutor({
        actorUserId: 'u-exec',
        getBoardState: () => boardState,
        commitBoardState: (next, meta) => {
          boardState = next;
          commits.push(meta);
        },
      }),
    );

    await act(async () => {
      const applied = await result.current.applyPreviewActions(
        [preview('unknownTool', { foo: 'bar' })],
        null,
      );
      expect(applied).toBe(false);
    });

    expect(commits).toHaveLength(0);
    expect(Object.keys(boardState)).toEqual([]);
    expect(result.current.error).toMatch(/AI apply failed/i);
  });

  it('disables undo after manual invalidation without showing an error', async () => {
    let boardState: BoardObjectsRecord = {};

    const { result } = renderHook(() =>
      useAIExecutor({
        actorUserId: 'u-exec',
        getBoardState: () => boardState,
        commitBoardState: (next) => {
          boardState = next;
        },
      }),
    );

    await act(async () => {
      const applied = await result.current.applyPreviewActions([
        preview('createStickyNote', {
          objectId: 'sticky-undo',
          text: 'Undo me',
          x: 100,
          y: 100,
        }),
      ]);
      expect(applied).toBe(true);
    });

    expect(result.current.canUndo).toBe(true);

    await act(async () => {
      result.current.invalidateUndo();
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.error).toBeNull();

    await act(async () => {
      const undone = await result.current.undoLast();
      expect(undone).toBe(false);
    });

    expect(result.current.error).toBeNull();
  });
});
