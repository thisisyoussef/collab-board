import { useEffect, useRef, useState, useCallback } from 'react';
import Konva from 'konva';
import { getBoardChannel, getAblyClient } from '../lib/ably';
import { createKonvaShape } from '../lib/shapes';
import type { BoardObject } from '../types';
import type { Message } from 'ably';

/**
 * Object sync hook — subscribe to create/update/delete via Ably, imperatively update Konva.
 * Per ably-firestore-sync skill: skip own, measure latency, update via stageRef.findOne().
 * Per vite-react-konva skill: objects live in objectsRef, never React state.
 */
export function useRealtimeBoard(
  boardId: string,
  userId: string,
  stageRef: React.RefObject<Konva.Stage | null>,
  objectLayerRef: React.RefObject<Konva.Layer | null>,
  objectsRef: React.MutableRefObject<Map<string, BoardObject>>,
  onObjectsChanged?: (objects: Record<string, BoardObject>) => void,
) {
  const onObjectsChangedRef = useRef(onObjectsChanged);
  onObjectsChangedRef.current = onObjectsChanged;
  const channelRef = useRef<ReturnType<typeof getBoardChannel> | null>(null);
  const latenciesRef = useRef<number[]>([]);
  const [avgObjectLatency, setAvgObjectLatency] = useState(0);

  useEffect(() => {
    const channel = getBoardChannel(boardId);
    channelRef.current = channel;
    const clientId = getAblyClient().auth.clientId;

    // Object created remotely
    const onObjectCreate = (msg: Message) => {
      const data = msg.data as BoardObject & { _ts?: number };
      if (msg.clientId === clientId) return;
      const obj = data;
      if (!obj || !obj.id) return;

      // Measure latency
      if (data._ts) {
        const latency = Date.now() - data._ts;
        latenciesRef.current.push(latency);
        if (latenciesRef.current.length > 100) latenciesRef.current.shift();
      }

      // Add to objectsRef
      objectsRef.current.set(obj.id, obj);

      // Add to Konva scene graph imperatively
      const layer = objectLayerRef.current;
      if (layer) {
        const shape = createKonvaShape(obj);
        layer.add(shape);
        layer.batchDraw();
      }
    };

    // Object updated remotely
    const onObjectUpdate = (msg: Message) => {
      const data = msg.data as { id: string; attrs: Partial<BoardObject>; _ts?: number };
      if (msg.clientId === clientId) return;
      const { id, attrs, _ts } = data;
      if (!id) return;

      // Measure latency
      if (_ts) {
        const latency = Date.now() - _ts;
        latenciesRef.current.push(latency);
        if (latenciesRef.current.length > 100) latenciesRef.current.shift();
      }

      // Last-write-wins conflict resolution — discard stale remote updates
      const existing = objectsRef.current.get(id);
      if (existing && attrs.updatedAt) {
        if (new Date(existing.updatedAt) >= new Date(attrs.updatedAt as string)) {
          return; // Local is newer or same, discard remote
        }
      }

      // Update objectsRef
      if (existing) {
        objectsRef.current.set(id, { ...existing, ...attrs });
      }

      // Update Konva node imperatively
      const stage = stageRef.current;
      if (stage) {
        const node = stage.findOne(`#${id}`);
        if (node) {
          node.setAttrs(attrs);
          node.getLayer()?.batchDraw();
        }
      }
    };

    // Object deleted remotely
    const onObjectDelete = (msg: Message) => {
      const data = msg.data as { id: string; _ts?: number };
      if (msg.clientId === clientId) return;
      const { id } = data;
      if (!id) return;

      // Remove from objectsRef
      objectsRef.current.delete(id);

      // Remove from Konva scene graph
      const stage = stageRef.current;
      if (stage) {
        const node = stage.findOne(`#${id}`);
        if (node) {
          const layer = node.getLayer();
          node.destroy();
          layer?.batchDraw();
        }
      }
    };

    channel.subscribe('object:create', onObjectCreate);
    channel.subscribe('object:update', onObjectUpdate);
    channel.subscribe('object:delete', onObjectDelete);

    // Update average latency every second
    const latencyInterval = setInterval(() => {
      const arr = latenciesRef.current;
      if (arr.length > 0) {
        setAvgObjectLatency(arr.reduce((a, b) => a + b, 0) / arr.length);
      }
    }, 1000);

    return () => {
      channel.unsubscribe('object:create', onObjectCreate);
      channel.unsubscribe('object:update', onObjectUpdate);
      channel.unsubscribe('object:delete', onObjectDelete);
      clearInterval(latencyInterval);
    };
  }, [boardId, userId, stageRef, objectLayerRef, objectsRef]);

  // Notify persistence layer of changes (debounced Firestore save)
  const notifyChanged = useCallback(() => {
    if (onObjectsChangedRef.current) {
      const serialized: Record<string, BoardObject> = {};
      objectsRef.current.forEach((obj, id) => {
        serialized[id] = obj;
      });
      onObjectsChangedRef.current(serialized);
    }
  }, [objectsRef]);

  // Publish functions — local optimistic updates happen at call site
  const publishCreate = useCallback(
    (obj: BoardObject) => {
      channelRef.current?.publish('object:create', { ...obj, _ts: Date.now() });
      notifyChanged();
    },
    [notifyChanged],
  );

  const publishUpdate = useCallback(
    (id: string, attrs: Partial<BoardObject>) => {
      channelRef.current?.publish('object:update', { id, attrs, _ts: Date.now() });
      notifyChanged();
    },
    [notifyChanged],
  );

  const publishDelete = useCallback(
    (id: string) => {
      channelRef.current?.publish('object:delete', { id, _ts: Date.now() });
      notifyChanged();
    },
    [notifyChanged],
  );

  // Load a full board state onto the canvas (used on Firestore load)
  const loadBoard = useCallback(
    (objects: Record<string, BoardObject>) => {
      const layer = objectLayerRef.current;
      if (!layer) return;

      // Clear existing
      layer.destroyChildren();
      objectsRef.current.clear();

      // Add all objects
      for (const obj of Object.values(objects)) {
        objectsRef.current.set(obj.id, obj);
        const shape = createKonvaShape(obj);
        layer.add(shape);
      }
      layer.batchDraw();
    },
    [objectLayerRef, objectsRef],
  );

  return { publishCreate, publishUpdate, publishDelete, loadBoard, avgObjectLatency };
}
