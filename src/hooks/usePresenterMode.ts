import type { User } from 'firebase/auth';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Socket } from 'socket.io-client';
import { getOrCreateGuestIdentity } from '../lib/guest';
import type {
  ClientToServerEvents,
  PresenterState,
  PresenterStatePayload,
  PresenterViewportPayload,
  ServerToClientEvents,
} from '../types/realtime';
import type { SocketStatus } from './useSocket';

const VIEWPORT_PUBLISH_THROTTLE_MS = 80;

interface ViewportState {
  x: number;
  y: number;
  scale: number;
}

interface UsePresenterModeParams {
  boardId: string | undefined;
  user: User | null;
  socketRef: MutableRefObject<Socket<ServerToClientEvents, ClientToServerEvents> | null>;
  socketStatus: SocketStatus;
  canStartPresenting: boolean;
}

interface UsePresenterModeResult {
  presenter: PresenterState | null;
  isPresenting: boolean;
  isFollowing: boolean;
  canFollow: boolean;
  pendingViewport: ViewportState | null;
  startPresenting: () => void;
  stopPresenting: () => void;
  startFollowing: () => void;
  stopFollowing: () => void;
  publishViewport: (viewport: ViewportState) => void;
  clearPendingViewport: () => void;
}

function isFiniteViewport(viewport: ViewportState): boolean {
  return Number.isFinite(viewport.x) && Number.isFinite(viewport.y) && Number.isFinite(viewport.scale);
}

export function usePresenterMode({
  boardId,
  user,
  socketRef,
  socketStatus,
  canStartPresenting,
}: UsePresenterModeParams): UsePresenterModeResult {
  const [presenter, setPresenter] = useState<PresenterState | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [pendingViewport, setPendingViewport] = useState<ViewportState | null>(null);
  const lastPublishAtRef = useRef(0);
  const guestIdentity = useMemo(() => getOrCreateGuestIdentity(), []);

  const selfUserId = user?.uid || guestIdentity.userId;
  const selfSocketId = socketRef.current?.id || null;
  const isPresenting = Boolean(presenter?.socketId && selfSocketId && presenter.socketId === selfSocketId);
  const canFollow = Boolean(presenter && !isPresenting);

  useEffect(() => {
    if (!boardId || socketStatus !== 'connected') {
      setPresenter(null);
      setIsFollowing(false);
      setPendingViewport(null);
      return;
    }

    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    const handlePresenterState = (payload: PresenterStatePayload) => {
      if (payload.boardId !== boardId) {
        return;
      }

      setPresenter(payload.presenter);

      if (!payload.presenter) {
        setIsFollowing(false);
        setPendingViewport(null);
        return;
      }

      if (socket.id && payload.presenter.socketId === socket.id) {
        setIsFollowing(false);
        setPendingViewport(null);
      }
    };

    const handlePresenterViewport = (payload: PresenterViewportPayload) => {
      if (payload.boardId !== boardId || !isFollowing || !presenter) {
        return;
      }

      if (payload.presenterUserId !== presenter.userId) {
        return;
      }

      const nextViewport: ViewportState = {
        x: Number(payload.x),
        y: Number(payload.y),
        scale: Number(payload.scale),
      };

      if (!isFiniteViewport(nextViewport)) {
        return;
      }

      setPendingViewport(nextViewport);
    };

    socket.on('presenter:state', handlePresenterState);
    socket.on('presenter:viewport', handlePresenterViewport);

    return () => {
      socket.off('presenter:state', handlePresenterState);
      socket.off('presenter:viewport', handlePresenterViewport);
    };
  }, [boardId, isFollowing, presenter, socketRef, socketStatus]);

  const startPresenting = useCallback(() => {
    if (!boardId || !canStartPresenting || socketStatus !== 'connected') {
      return;
    }

    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    socket.emit('presenter:start', { boardId });
  }, [boardId, canStartPresenting, socketRef, socketStatus]);

  const stopPresenting = useCallback(() => {
    if (!boardId || socketStatus !== 'connected') {
      return;
    }

    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    socket.emit('presenter:stop', { boardId });
    setPendingViewport(null);
  }, [boardId, socketRef, socketStatus]);

  const startFollowing = useCallback(() => {
    if (!canFollow) {
      return;
    }
    setIsFollowing(true);
  }, [canFollow]);

  const stopFollowing = useCallback(() => {
    setIsFollowing(false);
    setPendingViewport(null);
  }, []);

  const publishViewport = useCallback(
    (viewport: ViewportState) => {
      if (!boardId || !isPresenting || socketStatus !== 'connected') {
        return;
      }

      if (!isFiniteViewport(viewport)) {
        return;
      }

      const socket = socketRef.current;
      if (!socket) {
        return;
      }

      const now = Date.now();
      if (now - lastPublishAtRef.current < VIEWPORT_PUBLISH_THROTTLE_MS) {
        return;
      }
      lastPublishAtRef.current = now;

      const payload: PresenterViewportPayload = {
        boardId,
        presenterUserId: selfUserId,
        x: viewport.x,
        y: viewport.y,
        scale: viewport.scale,
        _ts: now,
      };

      socket.emit('presenter:viewport', payload);
    },
    [boardId, isPresenting, selfUserId, socketRef, socketStatus],
  );

  const clearPendingViewport = useCallback(() => {
    setPendingViewport(null);
  }, []);

  return {
    presenter,
    isPresenting,
    isFollowing,
    canFollow,
    pendingViewport,
    startPresenting,
    stopPresenting,
    startFollowing,
    stopFollowing,
    publishViewport,
    clearPendingViewport,
  };
}
