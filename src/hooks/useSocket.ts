import { useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getOrCreateGuestIdentity } from '../lib/guest';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/realtime';
import { useAuth } from './useAuth';

export type SocketStatus = 'connecting' | 'connected' | 'disconnected';

const SOCKET_URL = import.meta.env.VITE_SOCKET_SERVER_URL as string | undefined;

export function useSocket(boardId: string | undefined) {
  const { user } = useAuth();
  const guestIdentity = useMemo(() => getOrCreateGuestIdentity(), []);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<SocketStatus>('connecting');
  const canConnect = Boolean(boardId && SOCKET_URL);

  useEffect(() => {
    let cancelled = false;
    let refreshAttempted = false;

    if (!canConnect) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const connect = async () => {
      try {
        setConnectionStatus('connecting');
        const token = user ? await user.getIdToken() : null;
        if (cancelled) {
          return;
        }

        const socket = io(SOCKET_URL, {
          auth: token
            ? { token }
            : {
                guest: true,
                guestId: guestIdentity.userId,
                guestName: guestIdentity.displayName,
              },
          transports: ['websocket'],
          autoConnect: false,
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
        });

        socket.on('connect', () => {
          refreshAttempted = false;
          setConnectionStatus('connected');
        });

        socket.on('disconnect', () => {
          setConnectionStatus('disconnected');
        });

        socket.on('connect_error', async (err) => {
          setConnectionStatus('disconnected');

          if (!user || refreshAttempted || err.message !== 'Authentication failed') {
            return;
          }

          refreshAttempted = true;

          try {
            const newToken = await user.getIdToken(true);
            if (cancelled) return;
            socket.auth = { token: newToken };
            setConnectionStatus('connecting');
            socket.connect();
          } catch {
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
    };
  }, [boardId, canConnect, guestIdentity.displayName, guestIdentity.userId, user]);

  return { socketRef, status: canConnect ? connectionStatus : 'disconnected' };
}
