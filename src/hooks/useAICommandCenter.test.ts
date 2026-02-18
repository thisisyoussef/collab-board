import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetIdToken = vi.fn().mockResolvedValue('firebase-token-123');
const mockFetch = vi.fn();

const { useAICommandCenter } = await import('./useAICommandCenter');

describe('useAICommandCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        message: 'Plan prepared.',
        toolCalls: [],
      }),
    } as Response);
  });

  it('normalizes API payload into action previews', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        message: 'Created a plan.',
        toolCalls: [
          {
            id: 'tool-a',
            name: 'createStickyNote',
            input: { text: 'Research', x: 100, y: 120, color: '#FFEB3B' },
          },
        ],
      }),
    } as Response);

    const { result } = renderHook(() =>
      useAICommandCenter({
        boardId: 'board-1',
        user: { getIdToken: mockGetIdToken } as never,
        getBoardState: () => ({
          one: {
            id: 'one',
            type: 'sticky',
            x: 1,
            y: 2,
            width: 100,
            height: 80,
            rotation: 0,
            text: 'A',
            color: '#FFEB3B',
            fontSize: 14,
            zIndex: 1,
            createdBy: 'u1',
            updatedAt: new Date().toISOString(),
          },
        }),
      }),
    );

    await act(async () => {
      result.current.setPrompt('Create a research note');
    });

    await act(async () => {
      await result.current.submitPrompt();
    });

    expect(result.current.message).toBe('Created a plan.');
    expect(result.current.actions).toHaveLength(1);
    expect(result.current.actions[0]?.name).toBe('createStickyNote');
    expect(result.current.actions[0]?.summary).toContain('text=Research');

    const request = mockFetch.mock.calls[0]?.[1] as RequestInit;
    expect(request).toBeTruthy();
    expect(request.method).toBe('POST');
    expect(request.headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'application/json',
        Authorization: 'Bearer firebase-token-123',
      }),
    );
  });

  it('persists selected mode in localStorage', async () => {
    const firstRender = renderHook(() => useAICommandCenter({ boardId: 'board-1' }));

    await act(async () => {
      firstRender.result.current.setMode('auto');
    });

    expect(firstRender.result.current.mode).toBe('auto');
    firstRender.unmount();

    const secondRender = renderHook(() => useAICommandCenter({ boardId: 'board-1' }));
    expect(secondRender.result.current.mode).toBe('auto');
  });

  it('blocks duplicate submissions while loading', async () => {
    let resolveJson: ((value: unknown) => void) | null = null;
    const jsonPromise = new Promise((resolve) => {
      resolveJson = resolve;
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => jsonPromise,
    } as Response);

    const { result } = renderHook(() =>
      useAICommandCenter({
        boardId: 'board-1',
        user: { getIdToken: mockGetIdToken } as never,
      }),
    );

    await act(async () => {
      result.current.setPrompt('Build a quick template');
    });

    await act(async () => {
      void result.current.submitPrompt();
      void result.current.submitPrompt();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);

    resolveJson?.({
      message: 'Done',
      toolCalls: [],
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});
