import { useRef, useEffect, useCallback, useState } from 'react';
import { Stage, Layer } from 'react-konva';
import Konva from 'konva';
import { useCursors } from '../hooks/useCursors';
import { usePresence } from '../hooks/usePresence';
import { useRealtimeBoard } from '../hooks/useRealtimeBoard';
import { useFPS } from '../hooks/useFPS';
import { MetricsOverlay } from './MetricsOverlay';
import { Toolbar, createObjectForTool, type ToolType } from './Toolbar';
import { Background } from './Background';
import { SelectionManager } from './SelectionManager';
import { TextEditor } from './TextEditor';
import RemoteCursor from './RemoteCursor';
import { useFirestoreBoard } from '../hooks/useFirestoreBoard';
import { screenToWorld, worldToScreen } from '../lib/utils';
import { createKonvaShape } from '../lib/shapes';
import { updateVisibility } from '../lib/viewport';
import { getAblyClient } from '../lib/ably';
import { PresenceBar } from './PresenceBar';
import { ZOOM_FACTOR, MIN_SCALE, MAX_SCALE } from '../constants';
import type { BoardObject, CursorData } from '../types';

interface CanvasProps {
  boardId: string;
  userId: string;
  userName: string;
  userColor: string;
}

export function Canvas({ boardId, userId, userName, userColor }: CanvasProps) {
  // Refs — canvas objects live here, NEVER in React state
  const stageRef = useRef<Konva.Stage>(null);
  const objectLayerRef = useRef<Konva.Layer>(null);
  const selectionLayerRef = useRef<Konva.Layer>(null);
  const cursorLayerRef = useRef<Konva.Layer>(null);
  const objectsRef = useRef(new Map<string, BoardObject>());

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  // selectedIds in React state — appropriate per rules (small array, infrequent)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Text editor state
  const [editingText, setEditingText] = useState<{
    objectId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    fontSize: number;
  } | null>(null);

  // Loading / connection state
  const [loading, setLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);

  // Hooks — Firestore persistence with debounced save
  const { loadBoard: loadFromFirestore, triggerSave } = useFirestoreBoard(boardId);
  const { remoteCursors, publishCursor, avgLatency, removeCursor } =
    useCursors(boardId, userId, userName, userColor);
  const members = usePresence(boardId, userName, userColor, removeCursor);
  const { publishCreate, publishUpdate, publishDelete, loadBoard, avgObjectLatency } =
    useRealtimeBoard(boardId, userId, stageRef, objectLayerRef, objectsRef, triggerSave);
  const fps = useFPS();

  // Stable refs for callbacks used in imperative Konva event handlers
  const publishUpdateRef = useRef(publishUpdate);
  publishUpdateRef.current = publishUpdate;
  const publishDeleteRef = useRef(publishDelete);
  publishDeleteRef.current = publishDelete;

  // Board join sequence (per realtime-sync-patterns rule):
  // 1. Load from Firestore → 2. Render all objects → 3. Subscribe Ably → 4. Enter presence → 5. Start cursor
  // Steps 3-5 happen automatically via hooks. We just need to load + render here.
  useEffect(() => {
    let cancelled = false;
    const joinBoard = async () => {
      setLoading(true);
      const boardDoc = await loadFromFirestore();
      if (cancelled) return;
      if (boardDoc?.objects) {
        loadBoard(boardDoc.objects);
      }
      setLoading(false);
    };
    joinBoard();
    return () => { cancelled = true; };
  }, [loadFromFirestore, loadBoard]);

  // Reconnect handling — per ably-firestore-sync skill
  useEffect(() => {
    const ably = getAblyClient();

    const onConnected = async () => {
      setReconnecting(false);
      // Re-fetch from Firestore to reconcile
      const boardDoc = await loadFromFirestore();
      if (boardDoc?.objects) {
        loadBoard(boardDoc.objects);
      }
    };

    const onDisconnected = () => {
      setReconnecting(true);
    };

    ably.connection.on('connected', onConnected);
    ably.connection.on('disconnected', onDisconnected);

    return () => {
      ably.connection.off('connected', onConnected);
      ably.connection.off('disconnected', onDisconnected);
    };
  }, [loadFromFirestore, loadBoard]);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const syncViewport = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    setViewport({ x: stage.x(), y: stage.y(), scale: stage.scaleX() });
    updateVisibility(stage, objectsRef);
  }, []);

  // Zoom toward cursor — vite-react-konva skill verbatim
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current!;
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition()!;
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = direction > 0 ? oldScale * ZOOM_FACTOR : oldScale / ZOOM_FACTOR;
      const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
      stage.scale({ x: clampedScale, y: clampedScale });
      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };
      stage.position({
        x: pointer.x - mousePointTo.x * clampedScale,
        y: pointer.y - mousePointTo.y * clampedScale,
      });
      stage.batchDraw();
      syncViewport();
    },
    [syncViewport],
  );

  const handleDragEnd = useCallback(() => syncViewport(), [syncViewport]);

  const handlePointerMove = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const worldPos = screenToWorld(pointer, stage.position(), stage.scaleX());
    (publishCursor as (pos: { x: number; y: number }) => void)(worldPos);
  }, [publishCursor]);

  // Wire up event handlers on a Konva shape (imperatively created)
  const wireShapeEvents = useCallback(
    (shape: Konva.Group, objId: string) => {
      // Drag end → sync position
      shape.on('dragend', () => {
        const updated = {
          x: shape.x(),
          y: shape.y(),
          updatedAt: new Date().toISOString(),
        };
        const existing = objectsRef.current.get(objId);
        if (existing) objectsRef.current.set(objId, { ...existing, ...updated });
        publishUpdateRef.current(objId, updated);
      });

      // Click → select
      shape.on('click', (e) => {
        e.cancelBubble = true;
        if (e.evt.shiftKey) {
          setSelectedIds((prev) =>
            prev.includes(objId) ? prev.filter((id) => id !== objId) : [...prev, objId],
          );
        } else {
          setSelectedIds([objId]);
        }
      });

      // Double-click → text editor (sticky/text types)
      shape.on('dblclick', (e) => {
        e.cancelBubble = true;
        const obj = objectsRef.current.get(objId);
        if (!obj || (obj.type !== 'sticky' && obj.type !== 'text')) return;

        const stage = stageRef.current;
        if (!stage) return;
        const screenPos = worldToScreen(
          { x: obj.x, y: obj.y },
          stage.position(),
          stage.scaleX(),
        );
        setEditingText({
          objectId: objId,
          x: screenPos.x,
          y: screenPos.y,
          width: obj.width * stage.scaleX(),
          height: obj.height * stage.scaleX(),
          text: obj.text || '',
          fontSize: (obj.fontSize || 14) * stage.scaleX(),
        });
      });

      // Transform end → sync resize/rotate
      shape.on('transformend', () => {
        const scaleX = shape.scaleX();
        const scaleY = shape.scaleY();
        // Apply scale to width/height, reset scale to 1
        const firstChild = shape.children?.[0];
        const w = (firstChild?.width?.() || 100) * scaleX;
        const h = (firstChild?.height?.() || 100) * scaleY;
        shape.scaleX(1);
        shape.scaleY(1);
        if (firstChild && 'width' in firstChild && 'height' in firstChild) {
          (firstChild as Konva.Rect).width(w);
          (firstChild as Konva.Rect).height(h);
        }
        // Update text width for stickies
        const textNode = shape.findOne('Text') as Konva.Text | null;
        if (textNode) {
          textNode.width(w);
          textNode.height(h);
        }

        const updated: Partial<BoardObject> = {
          x: shape.x(),
          y: shape.y(),
          width: w,
          height: h,
          rotation: shape.rotation(),
          updatedAt: new Date().toISOString(),
        };
        const existing = objectsRef.current.get(objId);
        if (existing) objectsRef.current.set(objId, { ...existing, ...updated });
        publishUpdateRef.current(objId, updated);
        shape.getLayer()?.batchDraw();
      });
    },
    [],
  );

  // Click on empty canvas → create or deselect
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target !== stageRef.current) return;

      // Deselect if in select mode
      if (activeTool === 'select') {
        setSelectedIds([]);
        return;
      }

      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const worldPos = screenToWorld(pointer, stage.position(), stage.scaleX());
      const obj = createObjectForTool(activeTool, worldPos, userId);
      if (!obj) return;

      objectsRef.current.set(obj.id, obj);
      const layer = objectLayerRef.current;
      if (layer) {
        const shape = createKonvaShape(obj);
        wireShapeEvents(shape, obj.id);
        layer.add(shape);
        layer.batchDraw();
      }

      publishCreate(obj);
      setActiveTool('select');
    },
    [activeTool, userId, publishCreate, wireShapeEvents],
  );

  // Text editor submit
  const handleTextSubmit = useCallback(
    (text: string) => {
      if (!editingText) return;
      const { objectId } = editingText;
      const existing = objectsRef.current.get(objectId);
      if (existing) {
        const updated = { text, updatedAt: new Date().toISOString() };
        objectsRef.current.set(objectId, { ...existing, ...updated });
        // Update Konva text node
        const stage = stageRef.current;
        if (stage) {
          const node = stage.findOne(`#${objectId}`);
          const textNode = node?.findOne?.('Text') as Konva.Text | null;
          if (textNode) {
            textNode.text(text);
            textNode.getLayer()?.batchDraw();
          }
        }
        publishUpdate(objectId, updated);
      }
      setEditingText(null);
    },
    [editingText, publishUpdate],
  );

  // Delete selected objects
  const deleteSelected = useCallback(() => {
    for (const id of selectedIds) {
      objectsRef.current.delete(id);
      const stage = stageRef.current;
      if (stage) {
        const node = stage.findOne(`#${id}`);
        if (node) {
          const layer = node.getLayer();
          node.destroy();
          layer?.batchDraw();
        }
      }
      publishDelete(id);
    }
    setSelectedIds([]);
  }, [selectedIds, publishDelete]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle when editing text
      if (editingText) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          deleteSelected();
        }
      }
      if (e.key === 'Escape') {
        setActiveTool('select');
        setSelectedIds([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, editingText, deleteSelected]);

  const cursorEntries = Array.from(remoteCursors.values());

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontSize: 18, color: '#666',
      }}>
        Loading board...
      </div>
    );
  }

  return (
    <>
      {reconnecting && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          background: '#ff9800', color: '#fff', textAlign: 'center',
          padding: '8px', fontSize: 14, fontWeight: 600, zIndex: 5000,
        }}>
          Reconnecting...
        </div>
      )}

      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
      />

      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        draggable
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        onPointerMove={handlePointerMove}
        onClick={handleStageClick}
        style={{ background: '#fafafa' }}
      >
        <Layer listening={false}>
          <Background
            stageWidth={dimensions.width}
            stageHeight={dimensions.height}
            stageX={viewport.x}
            stageY={viewport.y}
            scale={viewport.scale}
          />
        </Layer>

        <Layer ref={objectLayerRef} />

        <Layer ref={selectionLayerRef}>
          <SelectionManager stageRef={stageRef} selectedIds={selectedIds} />
        </Layer>

        <Layer ref={cursorLayerRef} listening={false}>
          {cursorEntries.map((cursor: CursorData) => (
            <RemoteCursor
              key={cursor.userId}
              x={cursor.x}
              y={cursor.y}
              color={cursor.color}
              name={cursor.name}
            />
          ))}
        </Layer>
      </Stage>

      {editingText && (
        <TextEditor
          x={editingText.x}
          y={editingText.y}
          width={editingText.width}
          height={editingText.height}
          text={editingText.text}
          fontSize={editingText.fontSize}
          onSubmit={handleTextSubmit}
          onCancel={() => setEditingText(null)}
        />
      )}

      <MetricsOverlay
        fps={fps}
        cursorLatency={avgLatency}
        objectLatency={avgObjectLatency}
        userCount={members.length}
        objectCount={objectsRef.current.size}
      />

      <PresenceBar members={members} />
    </>
  );
}
