import { act, renderHook } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePresenterMode } from './usePresenterMode';

type SocketHandler = (...args: unknown[]) => void;

function createMockSocket() {
  const handlers = new Map<string, Set<SocketHandler>>();
  const emit = vi.fn();

  return {
    id: 'socket-self',
    emit,
    on: vi.fn((event: string, handler: SocketHandler) => {
      const set = handlers.get(event) ?? new Set<SocketHandler>();
      set.add(handler);
      handlers.set(event, set);
    }),
    off: vi.fn((event: string, handler: SocketHandler) => {
      handlers.get(event)?.delete(handler);
    }),
    trigger(event: string, ...args: unknown[]) {
      handlers.get(event)?.forEach((handler) => handler(...args));
    },
    emitMock: emit,
  };
}

const mockUser = {
  uid: 'user-123',
  displayName: 'Alex Johnson',
  email: 'alex@example.com',
} as User;

describe('usePresenterMode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('emits presenter:start and presenter:stop for eligible users', () => {
    const socket = createMockSocket();
    const socketRef = { current: socket as never };
    const { result } = renderHook(() =>
      usePresenterMode({
        boardId: 'board-1',
        user: mockUser,
        socketRef,
        socketStatus: 'connected',
        canStartPresenting: true,
      }),
    );

    act(() => {
      result.current.startPresenting();
      result.current.stopPresenting();
    });

    expect(socket.emitMock).toHaveBeenCalledWith(
      'presenter:start',
      expect.objectContaining({ boardId: 'board-1' }),
    );
    expect(socket.emitMock).toHaveBeenCalledWith(
      'presenter:stop',
      expect.objectContaining({ boardId: 'board-1' }),
    );
  });

  it('tracks presenter state and supports follow mode exit on presenter disconnect', () => {
    const socket = createMockSocket();
    const socketRef = { current: socket as never };
    const { result } = renderHook(() =>
      usePresenterMode({
        boardId: 'board-1',
        user: mockUser,
        socketRef,
        socketStatus: 'connected',
        canStartPresenting: true,
      }),
    );

    act(() => {
      socket.trigger('presenter:state', {
        boardId: 'board-1',
        presenter: {
          socketId: 'socket-other',
          userId: 'user-456',
          displayName: 'Sam Doe',
          color: 'hsl(10, 65%, 55%)',
        },
      });
    });

    expect(result.current.presenter?.displayName).toBe('Sam Doe');
    expect(result.current.canFollow).toBe(true);

    act(() => {
      result.current.startFollowing();
    });
    expect(result.current.isFollowing).toBe(true);

    act(() => {
      socket.trigger('presenter:state', { boardId: 'board-1', presenter: null });
    });

    expect(result.current.presenter).toBeNull();
    expect(result.current.isFollowing).toBe(false);
  });

  it('rebroadcasts presenter viewport when presenting and forwards incoming viewport while following', () => {
    const socket = createMockSocket();
    const socketRef = { current: socket as never };
    const { result } = renderHook(() =>
      usePresenterMode({
        boardId: 'board-1',
        user: mockUser,
        socketRef,
        socketStatus: 'connected',
        canStartPresenting: true,
      }),
    );

    act(() => {
      socket.trigger('presenter:state', {
        boardId: 'board-1',
        presenter: {
          socketId: 'socket-self',
          userId: 'user-123',
          displayName: 'Alex Johnson',
          color: 'hsl(20, 65%, 55%)',
        },
      });
    });

    act(() => {
      result.current.publishViewport({ x: 100, y: 200, scale: 1.25 });
    });

    expect(socket.emitMock).toHaveBeenCalledWith(
      'presenter:viewport',
      expect.objectContaining({ boardId: 'board-1', x: 100, y: 200, scale: 1.25 }),
    );

    act(() => {
      socket.trigger('presenter:state', {
        boardId: 'board-1',
        presenter: {
          socketId: 'socket-other',
          userId: 'user-456',
          displayName: 'Sam Doe',
          color: 'hsl(10, 65%, 55%)',
        },
      });
      result.current.startFollowing();
      socket.trigger('presenter:viewport', {
        boardId: 'board-1',
        presenterUserId: 'user-456',
        x: -20,
        y: 40,
        scale: 1.5,
        _ts: Date.now(),
      });
    });

    expect(result.current.pendingViewport).toMatchObject({ x: -20, y: 40, scale: 1.5 });
  });
});
