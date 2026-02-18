import { act, renderHook } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCursors } from './useCursors';

type SocketHandler = (...args: unknown[]) => void;

function createMockSocket() {
  const handlers = new Map<string, Set<SocketHandler>>();
  const volatileEmit = vi.fn();

  return {
    volatile: { emit: volatileEmit },
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
    volatileEmit,
  };
}

const mockUser = {
  uid: 'user-123',
  displayName: 'Alex Johnson',
  email: 'alex@example.com',
} as User;

describe('useCursors', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('publishes cursor moves with throttle and volatile emit', () => {
    const socket = createMockSocket();
    const socketRef = { current: socket as never };
    const { result } = renderHook(() =>
      useCursors({
        boardId: 'board-1',
        user: mockUser,
        socketRef,
        socketStatus: 'connected',
      }),
    );

    act(() => {
      result.current.publishCursor({ x: 10, y: 20 });
      result.current.publishCursor({ x: 12, y: 24 });
    });

    expect(socket.volatileEmit).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(60);
      result.current.publishCursor({ x: 14, y: 30 });
    });

    expect(socket.volatileEmit).toHaveBeenCalledTimes(2);
    expect(socket.volatileEmit).toHaveBeenLastCalledWith(
      'cursor:move',
      expect.objectContaining({
        x: 14,
        y: 30,
        userId: 'user-123',
      }),
    );
  });

  it('tracks remote cursors and latency averages', () => {
    const socket = createMockSocket();
    const socketRef = { current: socket as never };
    const { result } = renderHook(() =>
      useCursors({
        boardId: 'board-1',
        user: mockUser,
        socketRef,
        socketStatus: 'connected',
      }),
    );

    act(() => {
      socket.trigger('cursor:move', {
        socketId: 'socket-1',
        userId: 'user-456',
        displayName: 'Sam Doe',
        color: 'hsl(20, 65%, 55%)',
        x: 200,
        y: 300,
        _ts: Date.now() - 10,
      });
    });

    expect(result.current.remoteCursors).toHaveLength(1);
    expect(result.current.remoteCursors[0]).toMatchObject({
      socketId: 'socket-1',
      userId: 'user-456',
      displayName: 'Sam Doe',
    });
    expect(result.current.averageLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('removes remote cursor on user:left', () => {
    const socket = createMockSocket();
    const socketRef = { current: socket as never };
    const { result } = renderHook(() =>
      useCursors({
        boardId: 'board-1',
        user: mockUser,
        socketRef,
        socketStatus: 'connected',
      }),
    );

    act(() => {
      socket.trigger('cursor:move', {
        socketId: 'socket-1',
        userId: 'user-456',
        displayName: 'Sam Doe',
        color: 'hsl(20, 65%, 55%)',
        x: 200,
        y: 300,
        _ts: Date.now(),
      });
    });

    expect(result.current.remoteCursors).toHaveLength(1);

    act(() => {
      socket.trigger('user:left', { socketId: 'socket-1', userId: 'user-456' });
    });

    expect(result.current.remoteCursors).toHaveLength(0);
  });
});
