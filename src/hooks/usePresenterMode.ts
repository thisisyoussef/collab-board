import { useEffect, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { SocketStatus } from './useSocket';
import type {
  ClientToServerEvents,
  PresenterStatePayload,
  PresenterViewportPayload,
  PresenterViewportState,
  ServerToClientEvents,
} from '../types/realtime';
import type { Socket } from 'socket.io-client';

interface UsePresenterModeParams {
  boardId: string | undefined;
  currentUserId: string;
  currentUserDisplayName: string;
  canStartPresenting: boolean;
  socketRef: MutableRefObject<Socket<ServerToClientEvents, ClientToServerEvents> | null>;
  socketStatus: SocketStatus;
  getLocalViewport: () => PresenterViewportState | null;
  applyRemoteViewport: (viewport: PresenterViewportState) => void;
}

function toSafeViewport(value: PresenterViewportState | null | undefined): PresenterViewportState | null {
  if (!value) {
    return null;
  }

  const next = {
    x: Number(value.x),
    y: Number(value.y),
    scale: Number(value.scale),
    viewportWidth: Number(value.viewportWidth),
    viewportHeight: Number(value.viewportHeight),
  };

  if (!Number.isFinite(next.x) || !Number.isFinite(next.y) || !Number.isFinite(next.scale)) {
    return null;
  }
  if (next.viewportWidth <= 0 || next.viewportHeight <= 0) {
    return null;
  }
  next.scale = Math.max(0.1, Math.min(5, next.scale));
  return next;
}

export function usePresenterMode({
  boardId,
  currentUserId,
  currentUserDisplayName,
  canStartPresenting,
  socketRef,
  socketStatus,
  getLocalViewport,
  applyRemoteViewport,
}: UsePresenterModeParams) {
  const [activePresenterUserId, setActivePresenterUserId] = useState<string | null>(null);
  const [activePresenterDisplayName, setActivePresenterDisplayName] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  const isPresenting = Boolean(activePresenterUserId && activePresenterUserId === currentUserId);
  const canFollow = Boolean(
    activePresenterUserId &&
      activePresenterUserId !== currentUserId &&
      !isPresenting,
  );

  useEffect(() => {
    if (!boardId) {
      setActivePresenterUserId(null);
      setActivePresenterDisplayName(null);
      setIsFollowing(false);
    }
  }, [boardId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !boardId || socketStatus !== 'connected') {
      return;
    }

    const handlePresenterState = (payload: PresenterStatePayload) => {
      if (payload.boardId !== boardId) {
        return;
      }
      setActivePresenterUserId(payload.presenterUserId);
      setActivePresenterDisplayName(payload.presenterDisplayName || 'Presenter');
      if (payload.presenterUserId === currentUserId) {
        setIsFollowing(false);
      }
    };

    const handlePresenterStopped = (payload: { boardId: string; presenterUserId: string }) => {
      if (payload.boardId !== boardId) {
        return;
      }

      setActivePresenterUserId((previous) =>
        previous === payload.presenterUserId ? null : previous,
      );
      setActivePresenterDisplayName(null);
      if (payload.presenterUserId !== currentUserId) {
        setIsFollowing(false);
      }
    };

    const handlePresenterViewport = (payload: PresenterViewportPayload) => {
      if (payload.boardId !== boardId) {
        return;
      }
      if (!isFollowing || payload.presenterUserId !== activePresenterUserId) {
        return;
      }

      const nextViewport = toSafeViewport(payload.viewport);
      if (!nextViewport) {
        return;
      }
      applyRemoteViewport(nextViewport);
    };

    socket.on('presenter:state', handlePresenterState);
    socket.on('presenter:stopped', handlePresenterStopped);
    socket.on('presenter:viewport', handlePresenterViewport);

    return () => {
      socket.off('presenter:state', handlePresenterState);
      socket.off('presenter:stopped', handlePresenterStopped);
      socket.off('presenter:viewport', handlePresenterViewport);
    };
  }, [
    activePresenterUserId,
    applyRemoteViewport,
    boardId,
    currentUserId,
    isFollowing,
    socketRef,
    socketStatus,
  ]);

  const startPresenting = () => {
    if (!canStartPresenting || !boardId) {
      return;
    }

    const socket = socketRef.current;
    if (!socket?.connected) {
      return;
    }

    const viewport = toSafeViewport(getLocalViewport());
    setActivePresenterUserId(currentUserId);
    setActivePresenterDisplayName(currentUserDisplayName || 'Presenter');
    setIsFollowing(false);
    socket.emit('presenter:start', {
      boardId,
      presenterUserId: currentUserId,
      presenterDisplayName: currentUserDisplayName || 'Presenter',
      ...(viewport ? { viewport } : {}),
    });
  };

  const stopPresenting = () => {
    if (!boardId) {
      return;
    }

    const socket = socketRef.current;
    if (!socket?.connected) {
      return;
    }

    socket.emit('presenter:stop', { boardId });
    setActivePresenterUserId(null);
    setActivePresenterDisplayName(null);
  };

  const startFollowing = () => {
    if (!canFollow) {
      return;
    }
    setIsFollowing(true);
  };

  const stopFollowing = () => {
    setIsFollowing(false);
  };

  const publishViewport = () => {
    if (!boardId || !isPresenting) {
      return;
    }
    const socket = socketRef.current;
    if (!socket?.connected) {
      return;
    }

    const viewport = toSafeViewport(getLocalViewport());
    if (!viewport) {
      return;
    }

    socket.emit('presenter:viewport', {
      boardId,
      presenterUserId: currentUserId,
      presenterDisplayName: currentUserDisplayName || 'Presenter',
      viewport,
      _ts: Date.now(),
    });
  };

  return {
    activePresenterUserId,
    activePresenterDisplayName,
    isPresenting,
    canFollow,
    isFollowing,
    startPresenting,
    stopPresenting,
    startFollowing,
    stopFollowing,
    publishViewport,
  };
}
