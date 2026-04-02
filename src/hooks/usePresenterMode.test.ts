import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MutableRefObject } from 'react';
import type { PresenterStatePayload, PresenterViewportPayload } from '../types/realtime';
import { usePresenterMode } from './usePresenterMode';

type Handler = (payload: unknown) => void;

class MockSocket {
  connected = true;
  emit = vi.fn();
  private handlers = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler) {
    const existing = this.handlers.get(event) || new Set<Handler>();
    existing.add(handler);
    this.handlers.set(event, existing);
  }

  off(event: string, handler: Handler) {
    const existing = this.handlers.get(event);
    if (!existing) {
      return;
    }
    existing.delete(handler);
    if (existing.size === 0) {
      this.handlers.delete(event);
    }
  }

  trigger(event: string, payload: unknown) {
    const handlers = this.handlers.get(event);
    if (!handlers) {
      return;
    }
    handlers.forEach((handler) => handler(payload));
  }
}

describe('usePresenterMode', () => {
  it('starts presenter mode and emits presenter:start with viewport payload', () => {
    const socket = new MockSocket();
    const socketRef = {
      current: socket,
    } as unknown as MutableRefObject<MockSocket | null>;
    const applyRemoteViewport = vi.fn();
    const getLocalViewport = vi.fn(() => ({
      x: 120,
      y: 80,
      scale: 1.25,
      viewportWidth: 1200,
      viewportHeight: 700,
    }));

    const { result } = renderHook(() =>
      usePresenterMode({
        boardId: 'board-1',
        currentUserId: 'user-1',
        currentUserDisplayName: 'Alex',
        canStartPresenting: true,
        socketRef,
        socketStatus: 'connected',
        getLocalViewport,
        applyRemoteViewport,
      }),
    );

    act(() => {
      result.current.startPresenting();
    });

    expect(result.current.isPresenting).toBe(true);
    expect(socket.emit).toHaveBeenCalledWith(
      'presenter:start',
      expect.objectContaining({
        boardId: 'board-1',
        presenterUserId: 'user-1',
        presenterDisplayName: 'Alex',
      }),
    );
    expect(getLocalViewport).toHaveBeenCalled();
  });

  it('applies incoming presenter viewport when following another presenter', () => {
    const socket = new MockSocket();
    const socketRef = {
      current: socket,
    } as unknown as MutableRefObject<MockSocket | null>;
    const applyRemoteViewport = vi.fn();

    const { result } = renderHook(() =>
      usePresenterMode({
        boardId: 'board-1',
        currentUserId: 'user-2',
        currentUserDisplayName: 'Sam',
        canStartPresenting: false,
        socketRef,
        socketStatus: 'connected',
        getLocalViewport: () => null,
        applyRemoteViewport,
      }),
    );

    act(() => {
      socket.trigger('presenter:state', {
        boardId: 'board-1',
        presenterUserId: 'user-1',
        presenterDisplayName: 'Alex',
      } satisfies PresenterStatePayload);
    });

    act(() => {
      result.current.startFollowing();
    });

    act(() => {
      socket.trigger('presenter:viewport', {
        boardId: 'board-1',
        presenterUserId: 'user-1',
        presenterDisplayName: 'Alex',
        viewport: {
          x: 30,
          y: 40,
          scale: 1.5,
          viewportWidth: 1100,
          viewportHeight: 680,
        },
      } satisfies PresenterViewportPayload);
    });

    expect(result.current.isFollowing).toBe(true);
    expect(applyRemoteViewport).toHaveBeenCalledWith({
      x: 30,
      y: 40,
      scale: 1.5,
      viewportWidth: 1100,
      viewportHeight: 680,
    });
  });

  it('exits follow mode when presenter stops', () => {
    const socket = new MockSocket();
    const socketRef = {
      current: socket,
    } as unknown as MutableRefObject<MockSocket | null>;

    const { result } = renderHook(() =>
      usePresenterMode({
        boardId: 'board-1',
        currentUserId: 'user-2',
        currentUserDisplayName: 'Sam',
        canStartPresenting: false,
        socketRef,
        socketStatus: 'connected',
        getLocalViewport: () => null,
        applyRemoteViewport: vi.fn(),
      }),
    );

    act(() => {
      socket.trigger('presenter:state', {
        boardId: 'board-1',
        presenterUserId: 'user-1',
        presenterDisplayName: 'Alex',
      } satisfies PresenterStatePayload);
      result.current.startFollowing();
    });

    expect(result.current.isFollowing).toBe(true);

    act(() => {
      socket.trigger('presenter:stopped', {
        boardId: 'board-1',
        presenterUserId: 'user-1',
      });
    });

    expect(result.current.activePresenterUserId).toBeNull();
    expect(result.current.isFollowing).toBe(false);
  });
});
