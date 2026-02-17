import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { getBoardChannel, getAblyClient } from '../lib/ably';
import { throttleRAF } from '../lib/utils';
import type { CursorData } from '../types';
import type { Types } from 'ably';

/**
 * Cursor sync hook — RAF-throttled (16ms) broadcast, latency measurement.
 * Per realtime-sync-patterns rule: 16ms via requestAnimationFrame.
 * Per ably-firestore-sync skill: skip own, measure Date.now() - sentAt.
 */
export function useCursors(
  boardId: string,
  userId: string,
  userName: string,
  userColor: string,
) {
  const [remoteCursors, setRemoteCursors] = useState<Map<string, CursorData>>(
    () => new Map(),
  );
  const latenciesRef = useRef<number[]>([]);
  const [avgLatency, setAvgLatency] = useState(0);
  const channelRef = useRef<ReturnType<typeof getBoardChannel> | null>(null);

  // Subscribe to remote cursor events
  useEffect(() => {
    const channel = getBoardChannel(boardId);
    channelRef.current = channel;
    const clientId = getAblyClient().auth.clientId;

    const onCursorMove = (msg: Message) => {
      const data = msg.data as CursorData;
      // Skip own messages
      if (msg.clientId === clientId) return;
      if (!data || !data.userId) return;

      // Measure latency: Date.now() - sentAt
      const latency = Date.now() - data.sentAt;
      latenciesRef.current.push(latency);
      // Keep rolling window of 100
      if (latenciesRef.current.length > 100) {
        latenciesRef.current.shift();
      }

      setRemoteCursors((prev) => {
        const next = new Map(prev);
        next.set(data.userId, data);
        return next;
      });
    };

    channel.subscribe('cursor:move', onCursorMove);

    // Update average latency every second
    const latencyInterval = setInterval(() => {
      const arr = latenciesRef.current;
      if (arr.length > 0) {
        setAvgLatency(arr.reduce((a, b) => a + b, 0) / arr.length);
      }
    }, 1000);

    return () => {
      channel.unsubscribe('cursor:move', onCursorMove);
      clearInterval(latencyInterval);
    };
  }, [boardId]);

  // Remove cursor when a user leaves presence
  const removeCursor = useCallback((clientId: string) => {
    setRemoteCursors((prev) => {
      const next = new Map(prev);
      // Find by matching — presence clientId may differ from userId
      for (const [key, cursor] of next) {
        if (cursor.userId === clientId || key === clientId) {
          next.delete(key);
        }
      }
      return next;
    });
  }, []);

  // RAF-throttled publish (16ms / 60fps)
  const publishCursor = useMemo(
    () =>
      throttleRAF(((pos: { x: number; y: number }) => {
        channelRef.current?.publish('cursor:move', {
          userId,
          x: pos.x,
          y: pos.y,
          color: userColor,
          name: userName,
          sentAt: Date.now(),
        } satisfies CursorData);
      }) as (...args: unknown[]) => void),
    [userId, userColor, userName],
  );

  return { remoteCursors, publishCursor, avgLatency, removeCursor };
}
