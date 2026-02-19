import { useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getOrCreateGuestIdentity } from '../lib/guest';
import { logger } from '../lib/logger';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/realtime';
import { useAuth } from './useAuth';

export type SocketStatus = 'connecting' | 'connected' | 'disconnected';

const SOCKET_URL = import.meta.env.VITE_SOCKET_SERVER_URL as string | undefined;
const SOCKET_WAKE_TIMEOUT_MS = 8000;
const SOCKET_KEEPALIVE_MS = 120000;

function toHealthUrl(socketUrl: string): string {
  const trimmed = socketUrl.trim().replace(/\/+$/, '');
  if (trimmed.startsWith('wss://')) {
    return `https://${trimmed.slice('wss://'.length)}/health`;
  }
  if (trimmed.startsWith('ws://')) {
    return `http://${trimmed.slice('ws://'.length)}/health`;
  }
  return `${trimmed}/health`;
}

async function wakeSocketServer(socketUrl: string): Promise<void> {
  if (typeof fetch !== 'function') {
    return;
  }

  const pingPromise = fetch(toHealthUrl(socketUrl), {
    method: 'GET',
    mode: 'no-cors',
    cache: 'no-store',
    keepalive: true,
  }).catch(() => undefined);

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      pingPromise,
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, SOCKET_WAKE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function useSocket(boardId: string | undefined) {
  const { user } = useAuth();
  const guestIdentity = useMemo(() => getOrCreateGuestIdentity(), []);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<SocketStatus>('connecting');
  const [reconnectCount, setReconnectCount] = useState(0);
  const [connectedSinceMs, setConnectedSinceMs] = useState<number | null>(null);
  const [disconnectedSinceMs, setDisconnectedSinceMs] = useState<number | null>(null);
  const hasEverConnectedRef = useRef(false);
  const canConnect = Boolean(boardId && SOCKET_URL);

  useEffect(() => {
    if (!canConnect || !SOCKET_URL) {
      if (!SOCKET_URL) {
        logger.warn('SOCKET', 'Socket server URL not configured (VITE_SOCKET_SERVER_URL missing)');
      }
      return;
    }

    let active = true;
    const ping = () => {
      if (!active) {
        return;
      }
      logger.debug('SOCKET', `Waking socket server at ${toHealthUrl(SOCKET_URL)}`);
      void wakeSocketServer(SOCKET_URL);
    };

    ping();
    const intervalId = window.setInterval(ping, SOCKET_KEEPALIVE_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [canConnect]);

  useEffect(() => {
    let cancelled = false;
    let refreshAttempted = false;

    if (!canConnect) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      hasEverConnectedRef.current = false;
      return;
    }

    const connect = async () => {
      try {
        setConnectionStatus('connecting');
        if (SOCKET_URL) {
          void wakeSocketServer(SOCKET_URL);
        }
        const token = user ? await user.getIdToken() : null;
        if (cancelled) {
          return;
        }

        if (!token) {
          logger.warn('SOCKET', `Using guest identity for socket auth (no Firebase token)`, {
            guestId: guestIdentity.userId,
            guestName: guestIdentity.displayName,
          });
        }

        const socket = io(SOCKET_URL, {
          auth: token
            ? { token }
            : {
                guest: true,
                guestId: guestIdentity.userId,
                guestName: guestIdentity.displayName,
              },
          // Keep long-polling fallback for cold starts / flaky WS upgrades.
          transports: ['polling', 'websocket'],
          autoConnect: false,
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
        });

        socket.on('connect', () => {
          refreshAttempted = false;
          if (hasEverConnectedRef.current) {
            setReconnectCount((value) => {
              const next = value + 1;
              logger.info('SOCKET', `Socket reconnected (attempt #${next})`, { socketId: socket.id });
              return next;
            });
          } else {
            hasEverConnectedRef.current = true;
            logger.info('SOCKET', `Socket connected to server (first connection)`, {
              socketId: socket.id,
              transport: socket.io?.engine?.transport?.name,
            });
          }
          setConnectedSinceMs(Date.now());
          setDisconnectedSinceMs(null);
          setConnectionStatus('connected');
        });

        socket.on('disconnect', (reason) => {
          logger.warn('SOCKET', `Socket disconnected: ${reason}`, { reason });
          setDisconnectedSinceMs((previous) => previous ?? Date.now());
          setConnectionStatus('disconnected');
        });

        socket.on('connect_error', async (err) => {
          logger.warn('SOCKET', `Socket connection error: ${err.message}`, {
            hasEverConnected: hasEverConnectedRef.current,
            errorMessage: err.message,
          });
          setDisconnectedSinceMs((previous) => previous ?? Date.now());
          setConnectionStatus(hasEverConnectedRef.current ? 'disconnected' : 'connecting');
          if (SOCKET_URL) {
            void wakeSocketServer(SOCKET_URL);
          }

          if (!user || refreshAttempted || err.message !== 'Authentication failed') {
            return;
          }

          refreshAttempted = true;
          logger.info('SOCKET', 'Refreshing auth token for socket reconnect');

          try {
            const newToken = await user.getIdToken(true);
            if (cancelled) return;
            socket.auth = { token: newToken };
            setConnectionStatus('connecting');
            socket.connect();
          } catch (refreshErr: unknown) {
            const msg = refreshErr instanceof Error ? refreshErr.message : 'Unknown error';
            logger.error('SOCKET', `Auth token refresh failed — socket will stay disconnected: ${msg}`);
            setDisconnectedSinceMs((previous) => previous ?? Date.now());
            setConnectionStatus('disconnected');
          }
        });

        socketRef.current = socket;
        socket.connect();
      } catch {
        if (!cancelled) {
          setConnectionStatus('disconnected');
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      const socket = socketRef.current;
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
      socketRef.current = null;
      hasEverConnectedRef.current = false;
    };
  }, [boardId, canConnect, guestIdentity.displayName, guestIdentity.userId, user]);

  return {
    socketRef,
    status: canConnect ? connectionStatus : 'disconnected',
    reconnectCount,
    connectedSinceMs,
    disconnectedSinceMs,
  };
}
