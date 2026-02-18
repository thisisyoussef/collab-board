import type { User } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Socket } from 'socket.io-client';
import { generateColor } from '../lib/utils';
import type { SocketStatus } from './useSocket';
import type {
  ClientToServerEvents,
  CursorData,
  CursorMovePayload,
  ServerToClientEvents,
  UserLeftPayload,
} from '../types/realtime';

const CURSOR_THROTTLE_MS = 50;
const LATENCY_SAMPLE_WINDOW = 20;

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
  const lastEmitAtRef = useRef(0);
  const latenciesRef = useRef<number[]>([]);

  const publishCursor = useCallback(
    (position: { x: number; y: number }) => {
      if (!boardId || !user || socketStatus !== 'connected') {
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
        userId: user.uid,
        displayName: user.displayName || user.email || 'Unknown',
        color: generateColor(user.uid),
        _ts: now,
      };

      socket.volatile.emit('cursor:move', payload);
    },
    [boardId, socketRef, socketStatus, user],
  );

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !user || !boardId || socketStatus !== 'connected') {
      return;
    }

    const handleCursorMove = (payload: CursorMovePayload) => {
      const normalized = toSafeCursor(payload);
      if (!normalized) {
        return;
      }

      const latency = Math.max(0, Date.now() - Number(payload._ts || 0));
      const nextLatencies = [...latenciesRef.current, latency].slice(-LATENCY_SAMPLE_WINDOW);
      latenciesRef.current = nextLatencies;
      const average = nextLatencies.reduce((sum, value) => sum + value, 0) / nextLatencies.length;
      setAverageLatencyMs(Math.round(average));

      setRemoteCursors((previous) => {
        const next = previous.filter((entry) => entry.socketId !== normalized.socketId);
        next.push(normalized);
        return next;
      });
    };

    const handleUserLeft = (payload: UserLeftPayload) => {
      const socketId = payload.socketId?.trim();
      if (!socketId) {
        return;
      }

      setRemoteCursors((previous) => previous.filter((entry) => entry.socketId !== socketId));
    };

    socket.on('cursor:move', handleCursorMove);
    socket.on('user:left', handleUserLeft);

    return () => {
      socket.off('cursor:move', handleCursorMove);
      socket.off('user:left', handleUserLeft);
    };
  }, [boardId, socketRef, socketStatus, user]);

  return {
    remoteCursors: socketStatus === 'connected' ? remoteCursors : [],
    averageLatencyMs,
    publishCursor,
  };
}
