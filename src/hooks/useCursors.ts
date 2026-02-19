import type { User } from 'firebase/auth';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Socket } from 'socket.io-client';
import { getOrCreateGuestIdentity } from '../lib/guest';
import { logger } from '../lib/logger';
import { generateColor } from '../lib/utils';
import type { SocketStatus } from './useSocket';
import type {
  ClientToServerEvents,
  CursorData,
  CursorHidePayload,
  CursorMovePayload,
  ServerToClientEvents,
  UserLeftPayload,
} from '../types/realtime';

const CURSOR_THROTTLE_MS = 16;
const CURSOR_HIDE_THROTTLE_MS = 150;
const CURSOR_STALE_TTL_MS = 4000;
const CURSOR_STALE_SWEEP_MS = 1000;
const LATENCY_SAMPLE_WINDOW = 20;
const LATENCY_UI_UPDATE_MS = 120;

export interface RemoteCursor {
  socketId: string;
  userId: string;
  displayName: string;
  color: string;
  x: number;
  y: number;
}

interface UseCursorsParams {
  boardId: string | undefined;
  user: User | null;
  socketRef: MutableRefObject<Socket<ServerToClientEvents, ClientToServerEvents> | null>;
  socketStatus: SocketStatus;
}

function toSafeCursor(payload: CursorMovePayload): RemoteCursor | null {
  const socketId = payload.socketId?.trim();
  if (!socketId) {
    return null;
  }

  const x = Number(payload.x);
  const y = Number(payload.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  const userId = payload.userId?.trim() || 'unknown';
  return {
    socketId,
    userId,
    displayName: payload.displayName?.trim() || 'Unknown',
    color: payload.color?.trim() || generateColor(userId),
    x,
    y,
  };
}

export function useCursors({ boardId, user, socketRef, socketStatus }: UseCursorsParams) {
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [averageLatencyMs, setAverageLatencyMs] = useState(0);
  const guestIdentity = useMemo(() => getOrCreateGuestIdentity(), []);
  const lastEmitAtRef = useRef(0);
  const lastHideEmitAtRef = useRef(0);
  const lastLatencyUiUpdateAtRef = useRef(0);
  const latenciesRef = useRef<number[]>([]);
  const cursorTouchedAtRef = useRef<Record<string, number>>({});

  const selfIdentity = useMemo(
    () => ({
      userId: user?.uid || guestIdentity.userId,
      displayName: user?.displayName || user?.email || guestIdentity.displayName,
      color: generateColor(user?.uid || guestIdentity.userId),
    }),
    [guestIdentity.displayName, guestIdentity.userId, user],
  );

  const publishCursor = useCallback(
    (position: { x: number; y: number }) => {
      if (!boardId || socketStatus !== 'connected') {
        return;
      }

      const socket = socketRef.current;
      if (!socket) {
        return;
      }

      const x = Number(position.x);
      const y = Number(position.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return;
      }

      const now = Date.now();
      if (now - lastEmitAtRef.current < CURSOR_THROTTLE_MS) {
        return;
      }

      lastEmitAtRef.current = now;
      const payload: CursorData = {
        x,
        y,
        userId: selfIdentity.userId,
        displayName: selfIdentity.displayName,
        color: selfIdentity.color,
        _ts: now,
      };

      socket.volatile.emit('cursor:move', payload);
    },
    [boardId, selfIdentity.color, selfIdentity.displayName, selfIdentity.userId, socketRef, socketStatus],
  );

  const publishCursorHide = useCallback(() => {
    if (!boardId || socketStatus !== 'connected') {
      return;
    }

    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    const now = Date.now();
    if (now - lastHideEmitAtRef.current < CURSOR_HIDE_THROTTLE_MS) {
      return;
    }

    lastHideEmitAtRef.current = now;
    socket.emit('cursor:hide', { _ts: now });
  }, [boardId, socketRef, socketStatus]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !boardId || socketStatus !== 'connected') {
      return;
    }

    const handleCursorMove = (payload: CursorMovePayload) => {
      const normalized = toSafeCursor(payload);
      if (!normalized) {
        return;
      }

      const latency = Math.max(0, Date.now() - Number(payload._ts || 0));
      if (latency > 100) {
        logger.warn('PERFORMANCE', `Cursor latency spike: ${latency}ms (target: <50ms)`, {
          latency,
          socketId: normalized.socketId,
          displayName: normalized.displayName,
        });
      }
      const nextLatencies = [...latenciesRef.current, latency].slice(-LATENCY_SAMPLE_WINDOW);
      latenciesRef.current = nextLatencies;
      const now = Date.now();
      if (now - lastLatencyUiUpdateAtRef.current >= LATENCY_UI_UPDATE_MS) {
        lastLatencyUiUpdateAtRef.current = now;
        const average = nextLatencies.reduce((sum, value) => sum + value, 0) / nextLatencies.length;
        setAverageLatencyMs(Math.round(average));
      }

      cursorTouchedAtRef.current[normalized.socketId] = now;
      setRemoteCursors((previous) => {
        const existing = previous.find((entry) => entry.socketId === normalized.socketId);
        if (
          existing &&
          existing.x === normalized.x &&
          existing.y === normalized.y &&
          existing.displayName === normalized.displayName &&
          existing.color === normalized.color &&
          existing.userId === normalized.userId
        ) {
          return previous;
        }

        const next = previous.filter((entry) => entry.socketId !== normalized.socketId);
        next.push(normalized);
        return next;
      });
    };

    const removeCursorBySocketId = (socketId: string) => {
      delete cursorTouchedAtRef.current[socketId];
      setRemoteCursors((previous) => previous.filter((entry) => entry.socketId !== socketId));
    };

    const handleCursorHide = (payload: CursorHidePayload) => {
      const socketId = payload.socketId?.trim();
      if (!socketId) {
        return;
      }

      removeCursorBySocketId(socketId);
    };

    const handleUserLeft = (payload: UserLeftPayload) => {
      const socketId = payload.socketId?.trim();
      if (!socketId) {
        return;
      }

      removeCursorBySocketId(socketId);
    };

    socket.on('cursor:move', handleCursorMove);
    socket.on('cursor:hide', handleCursorHide);
    socket.on('user:left', handleUserLeft);

    return () => {
      socket.off('cursor:move', handleCursorMove);
      socket.off('cursor:hide', handleCursorHide);
      socket.off('user:left', handleUserLeft);
    };
  }, [boardId, socketRef, socketStatus]);

  useEffect(() => {
    if (!boardId || socketStatus !== 'connected') {
      return;
    }

    const intervalId = window.setInterval(() => {
      const cutoff = Date.now() - CURSOR_STALE_TTL_MS;
      setRemoteCursors((previous) => {
        const next = previous.filter((cursor) => {
          const touchedAt = cursorTouchedAtRef.current[cursor.socketId] || 0;
          const keep = touchedAt >= cutoff;
          if (!keep) {
            delete cursorTouchedAtRef.current[cursor.socketId];
          }
          return keep;
        });
        const removed = previous.length - next.length;
        if (removed > 0) {
          logger.debug('PRESENCE', `Cleaned ${removed} stale cursor(s)`, { removedCount: removed });
        }
        return next.length === previous.length ? previous : next;
      });
    }, CURSOR_STALE_SWEEP_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [boardId, socketStatus]);

  useEffect(() => {
    if (!boardId || socketStatus !== 'connected') {
      return;
    }

    const handleWindowBlur = () => {
      publishCursorHide();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        publishCursorHide();
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('pagehide', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('pagehide', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [boardId, publishCursorHide, socketStatus]);

  return {
    remoteCursors: socketStatus === 'connected' ? remoteCursors : [],
    averageLatencyMs,
    publishCursor,
    publishCursorHide,
  };
}
