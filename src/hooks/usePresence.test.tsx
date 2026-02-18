import { act, renderHook } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePresence } from './usePresence';

type SocketHandler = (...args: unknown[]) => void;

function createMockSocket(connected = true) {
  const handlers = new Map<string, Set<SocketHandler>>();

  return {
    connected,
    on: vi.fn((event: string, handler: SocketHandler) => {
      const set = handlers.get(event) ?? new Set<SocketHandler>();
      set.add(handler);
      handlers.set(event, set);
    }),
    off: vi.fn((event: string, handler: SocketHandler) => {
      handlers.get(event)?.delete(handler);
    }),
    emit: vi.fn(),
    trigger(event: string, ...args: unknown[]) {
      handlers.get(event)?.forEach((handler) => {
        handler(...args);
      });
    },
  };
}

const mockUser = {
  uid: 'user-123',
  displayName: 'Alex Johnson',
  email: 'alex@example.com',
} as User;

describe('usePresence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('emits join-board when mounted with an active socket', () => {
    const socket = createMockSocket(true);
    const socketRef = { current: socket as never };

    renderHook(() =>
      usePresence({
        boardId: 'board-1',
        user: mockUser,
        socketRef,
        socketStatus: 'connected',
      }),
    );

    expect(socket.emit).toHaveBeenCalledWith(
      'join-board',
      expect.objectContaining({
        boardId: 'board-1',
        user: expect.objectContaining({
          id: 'user-123',
          displayName: 'Alex Johnson',
        }),
      }),
    );
  });

  it('hydrates members from presence:snapshot', () => {
    const socket = createMockSocket(true);
    const socketRef = { current: socket as never };
    const { result } = renderHook(() =>
      usePresence({
        boardId: 'board-1',
        user: mockUser,
        socketRef,
        socketStatus: 'connected',
      }),
    );

    act(() => {
      socket.trigger('presence:snapshot', [
        {
          socketId: 'socket-a',
          userId: 'user-123',
          displayName: 'Alex Johnson',
          color: 'hsl(10, 65%, 55%)',
        },
        {
          socketId: 'socket-b',
          userId: 'user-456',
          displayName: 'Sam Doe',
          color: 'hsl(80, 65%, 55%)',
        },
      ]);
    });

    expect(result.current.members).toHaveLength(2);
    expect(result.current.members[0].displayName).toBe('Alex Johnson');
    expect(result.current.members[1].displayName).toBe('Sam Doe');
  });

  it('adds users on user:joined and removes them after user:left animation delay', () => {
    const socket = createMockSocket(true);
    const socketRef = { current: socket as never };
    const { result } = renderHook(() =>
      usePresence({
        boardId: 'board-1',
        user: mockUser,
        socketRef,
        socketStatus: 'connected',
      }),
    );

    act(() => {
      socket.trigger('presence:snapshot', [
        {
          socketId: 'socket-a',
          userId: 'user-123',
          displayName: 'Alex Johnson',
          color: 'hsl(10, 65%, 55%)',
        },
      ]);
    });

    act(() => {
      socket.trigger('user:joined', {
        socketId: 'socket-b',
        userId: 'user-456',
        displayName: 'Sam Doe',
        color: 'hsl(80, 65%, 55%)',
      });
    });

    expect(result.current.members).toHaveLength(2);

    act(() => {
      socket.trigger('user:left', { socketId: 'socket-b', userId: 'user-456' });
    });

    expect(result.current.members.find((member) => member.socketId === 'socket-b')?.isLeaving).toBe(
      true,
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.members).toHaveLength(1);
    expect(result.current.members[0].socketId).toBe('socket-a');
  });
});
