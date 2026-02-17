import { useRef, useEffect, useCallback, useState } from 'react';
import { Stage, Layer, Rect as KonvaRect } from 'react-konva';
import Konva from 'konva';
import { useCursors } from '../hooks/useCursors';
import { usePresence } from '../hooks/usePresence';
import { useRealtimeBoard } from '../hooks/useRealtimeBoard';
import { useFPS } from '../hooks/useFPS';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { MetricsOverlay } from './MetricsOverlay';
import { Toolbar, createObjectForTool, type ToolType } from './Toolbar';
import { Background } from './Background';
import { SelectionManager } from './SelectionManager';
import { TextEditor } from './TextEditor';
import { ZoomControls } from './ZoomControls';
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
    color: string;
  } | null>(null);

  // Drag-to-draw state for rectangle tool
  const drawingRef = useRef<{
    startWorld: { x: number; y: number };
    previewShape: Konva.Rect | null;
  } | null>(null);

  // Rubber-band multi-selection state
  const [selectionRect, setSelectionRect] = useState<{
    x: number; y: number; width: number; height: number;
    visible: boolean;
  }>({ x: 0, y: 0, width: 0, height: 0, visible: false });
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);

  // Loading / connection state
  const [loading, setLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);

  // Undo/redo
  const { pushAction, popUndo, popRedo } = useUndoRedo();

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
  const pushActionRef = useRef(pushAction);
  pushActionRef.current = pushAction;
  const wireShapeEventsRef = useRef<(shape: Konva.Group, objId: string) => void>(undefined);

  // Board join sequence — load from Firestore, render, then subscribe.
  // No retry loop: if doc doesn't exist yet (new board), show empty canvas immediately.
  useEffect(() => {
    let cancelled = false;
    const joinBoard = async () => {
      setLoading(true);
      const boardDoc = await loadFromFirestore();
      if (cancelled) return;
      if (boardDoc?.objects && Object.keys(boardDoc.objects).length > 0) {
        loadBoard(boardDoc.objects);
        // Wire events on loaded shapes
        const layer = objectLayerRef.current;
        if (layer) {
          layer.children?.forEach((child) => {
            if (child instanceof Konva.Group && child.id()) {
              wireShapeEventsRef.current?.(child, child.id());
            }
          });
        }
      }
      // Always show canvas — empty or populated
      setLoading(false);
    };
    joinBoard();
    return () => { cancelled = true; };
  }, [loadFromFirestore, loadBoard]);

  // Reconnect handling
  useEffect(() => {
    const ably = getAblyClient();

    const onConnected = async () => {
      setReconnecting(false);
      const boardDoc = await loadFromFirestore();
      if (boardDoc?.objects) {
        loadBoard(boardDoc.objects);
        const layer = objectLayerRef.current;
        if (layer) {
          layer.children?.forEach((child) => {
            if (child instanceof Konva.Group && child.id()) {
              wireShapeEventsRef.current?.(child, child.id());
            }
          });
        }
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

  // Zoom toward cursor
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
      // Remove existing listeners to avoid duplicates on reconnect
      shape.off('dragend');
      shape.off('click');
      shape.off('dblclick');
      shape.off('transformend');

      // Drag end → sync position
      shape.on('dragend', () => {
        const existing = objectsRef.current.get(objId);
        const previousState = existing ? { ...existing } : undefined;
        const updated = {
          x: shape.x(),
          y: shape.y(),
          updatedAt: new Date().toISOString(),
        };
        if (existing) {
          objectsRef.current.set(objId, { ...existing, ...updated });
          pushActionRef.current({
            type: 'update',
            objectId: objId,
            object: { ...existing, ...updated },
            previousState,
          });
        }
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
          color: obj.color,
        });
      });

      // Transform end → sync resize/rotate
      shape.on('transformend', () => {
        const existing = objectsRef.current.get(objId);
        const previousState = existing ? { ...existing } : undefined;
        const scaleX = shape.scaleX();
        const scaleY = shape.scaleY();
        const firstChild = shape.children?.[0];
        const w = (firstChild?.width?.() || 100) * scaleX;
        const h = (firstChild?.height?.() || 100) * scaleY;
        shape.scaleX(1);
        shape.scaleY(1);
        if (firstChild && 'width' in firstChild && 'height' in firstChild) {
          (firstChild as Konva.Rect).width(w);
          (firstChild as Konva.Rect).height(h);
        }
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
        if (existing) {
          objectsRef.current.set(objId, { ...existing, ...updated });
          pushActionRef.current({
            type: 'update',
            objectId: objId,
            object: { ...existing, ...updated },
            previousState,
          });
        }
        publishUpdateRef.current(objId, updated);
        shape.getLayer()?.batchDraw();
      });
    },
    [],
  );

  // Keep wireShapeEventsRef in sync
  wireShapeEventsRef.current = wireShapeEvents;

  // Helper: add object to canvas, wire events, publish, auto-select
  const addObjectToBoard = useCallback(
    (obj: BoardObject) => {
      objectsRef.current.set(obj.id, obj);
      const layer = objectLayerRef.current;
      if (layer) {
        const shape = createKonvaShape(obj);
        wireShapeEvents(shape, obj.id);
        layer.add(shape);
        layer.batchDraw();
      }
      publishCreate(obj);
      pushAction({ type: 'create', objectId: obj.id, object: obj });
      // Auto-select newly created element (fix #3)
      setSelectedIds([obj.id]);
    },
    [publishCreate, wireShapeEvents, pushAction],
  );

  // ---- Stage event handlers ----

  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Only handle clicks on the stage background
      if (e.target !== stageRef.current) return;

      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const worldPos = screenToWorld(pointer, stage.position(), stage.scaleX());

      // Drag-to-draw for rect tool (fix #1)
      if (activeTool === 'rect') {
        // Prevent stage dragging while drawing
        stage.draggable(false);
        const layer = objectLayerRef.current;
        if (layer) {
          const preview = new Konva.Rect({
            x: worldPos.x,
            y: worldPos.y,
            width: 0,
            height: 0,
            fill: '#E3F2FD',
            stroke: '#90CAF9',
            strokeWidth: 1,
            dash: [4, 4],
            opacity: 0.7,
          });
          layer.add(preview);
          layer.batchDraw();
          drawingRef.current = { startWorld: worldPos, previewShape: preview };
        }
        return;
      }

      // Rubber-band multi-selection (fix #5)
      if (activeTool === 'select') {
        stage.draggable(false);
        selectionStartRef.current = worldPos;
        setSelectionRect({ x: worldPos.x, y: worldPos.y, width: 0, height: 0, visible: true });
        return;
      }
    },
    [activeTool],
  );

  const handleStageMouseMove = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const worldPos = screenToWorld(pointer, stage.position(), stage.scaleX());

      // Drag-to-draw preview for rect
      if (drawingRef.current) {
        const { startWorld, previewShape } = drawingRef.current;
        if (previewShape) {
          const x = Math.min(startWorld.x, worldPos.x);
          const y = Math.min(startWorld.y, worldPos.y);
          const w = Math.abs(worldPos.x - startWorld.x);
          const h = Math.abs(worldPos.y - startWorld.y);
          previewShape.setAttrs({ x, y, width: w, height: h });
          previewShape.getLayer()?.batchDraw();
        }
        return;
      }

      // Rubber-band selection preview
      if (selectionStartRef.current) {
        const start = selectionStartRef.current;
        const x = Math.min(start.x, worldPos.x);
        const y = Math.min(start.y, worldPos.y);
        const w = Math.abs(worldPos.x - start.x);
        const h = Math.abs(worldPos.y - start.y);
        setSelectionRect({ x, y, width: w, height: h, visible: true });
        return;
      }

      // Broadcast cursor position
      handlePointerMove();
    },
    [handlePointerMove],
  );

  const handleStageMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;

      // Finalize drag-to-draw rectangle (fix #1)
      if (drawingRef.current) {
        const { startWorld, previewShape } = drawingRef.current;
        if (previewShape) {
          previewShape.destroy();
          previewShape.getLayer()?.batchDraw();
        }

        const pointer = stage.getPointerPosition();
        if (pointer) {
          const worldPos = screenToWorld(pointer, stage.position(), stage.scaleX());
          const x = Math.min(startWorld.x, worldPos.x);
          const y = Math.min(startWorld.y, worldPos.y);
          const w = Math.abs(worldPos.x - startWorld.x);
          const h = Math.abs(worldPos.y - startWorld.y);

          // If dragged a meaningful size, create a rect with those dimensions
          if (w > 5 && h > 5) {
            const now = new Date().toISOString();
            const obj: BoardObject = {
              id: crypto.randomUUID(),
              type: 'rect',
              x,
              y,
              width: w,
              height: h,
              rotation: 0,
              color: '#E3F2FD',
              zIndex: 0,
              createdBy: userId,
              updatedAt: now,
            };
            addObjectToBoard(obj);
          }
        }

        drawingRef.current = null;
        stage.draggable(true);
        setActiveTool('select');
        return;
      }

      // Finalize rubber-band selection (fix #5)
      if (selectionStartRef.current) {
        const start = selectionStartRef.current;
        selectionStartRef.current = null;
        setSelectionRect((prev) => ({ ...prev, visible: false }));
        stage.draggable(true);

        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const worldPos = screenToWorld(pointer, stage.position(), stage.scaleX());
        const rx = Math.min(start.x, worldPos.x);
        const ry = Math.min(start.y, worldPos.y);
        const rw = Math.abs(worldPos.x - start.x);
        const rh = Math.abs(worldPos.y - start.y);

        // If it was just a click (not a drag), deselect
        if (rw < 5 && rh < 5) {
          if (e.target === stage) {
            setSelectedIds([]);
          }
          return;
        }

        // Find objects within the selection rectangle
        const selected: string[] = [];
        objectsRef.current.forEach((obj, id) => {
          if (
            obj.x + obj.width > rx &&
            obj.x < rx + rw &&
            obj.y + obj.height > ry &&
            obj.y < ry + rh
          ) {
            selected.push(id);
          }
        });
        setSelectedIds(selected);
        return;
      }
    },
    [userId, addObjectToBoard],
  );

  // Click on empty canvas → create sticky (single click tools)
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target !== stageRef.current) return;

      // Select tool and rubber-band selection are handled in mousedown/mouseup
      if (activeTool === 'select') return;
      // Rect tool uses drag-to-draw, but also allow single-click fallback
      if (activeTool === 'rect') return;

      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const worldPos = screenToWorld(pointer, stage.position(), stage.scaleX());
      const obj = createObjectForTool(activeTool, worldPos, userId);
      if (!obj) return;

      addObjectToBoard(obj);
      setActiveTool('select');
    },
    [activeTool, userId, addObjectToBoard],
  );

  // Text editor submit
  const handleTextSubmit = useCallback(
    (text: string) => {
      if (!editingText) return;
      const { objectId } = editingText;
      const existing = objectsRef.current.get(objectId);
      if (existing) {
        const previousState = { ...existing };
        const updated = { text, updatedAt: new Date().toISOString() };
        objectsRef.current.set(objectId, { ...existing, ...updated });
        // Update Konva text node
        const stage = stageRef.current;
        if (stage) {
          const node = stage.findOne(`#${objectId}`) as Konva.Group | null;
          const textNode = node?.findOne?.('Text') as Konva.Text | null;
          if (textNode) {
            textNode.text(text);
            textNode.getLayer()?.batchDraw();
          }
        }
        publishUpdate(objectId, updated);
        pushAction({
          type: 'update',
          objectId,
          object: { ...existing, ...updated },
          previousState,
        });
      }
      setEditingText(null);
    },
    [editingText, publishUpdate, pushAction],
  );

  // Delete selected objects
  const deleteSelected = useCallback(() => {
    for (const id of selectedIds) {
      const existing = objectsRef.current.get(id);
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
      if (existing) {
        pushAction({ type: 'delete', objectId: id, object: existing });
      }
    }
    setSelectedIds([]);
  }, [selectedIds, publishDelete, pushAction]);

  // Undo handler
  const handleUndo = useCallback(() => {
    const action = popUndo();
    if (!action) return;

    const stage = stageRef.current;
    const layer = objectLayerRef.current;
    if (!stage || !layer) return;

    switch (action.type) {
      case 'create': {
        // Undo create = delete the object
        objectsRef.current.delete(action.objectId);
        const node = stage.findOne(`#${action.objectId}`);
        if (node) {
          node.destroy();
          layer.batchDraw();
        }
        publishDelete(action.objectId);
        setSelectedIds((prev) => prev.filter((id) => id !== action.objectId));
        break;
      }
      case 'delete': {
        // Undo delete = re-create the object
        if (action.object) {
          objectsRef.current.set(action.objectId, action.object);
          const shape = createKonvaShape(action.object);
          wireShapeEvents(shape, action.objectId);
          layer.add(shape);
          layer.batchDraw();
          publishCreate(action.object);
        }
        break;
      }
      case 'update': {
        // Undo update = restore previous state
        if (action.previousState) {
          objectsRef.current.set(action.objectId, action.previousState);
          const node = stage.findOne(`#${action.objectId}`) as Konva.Group | null;
          if (node) {
            node.setAttrs({
              x: action.previousState.x,
              y: action.previousState.y,
              rotation: action.previousState.rotation,
            });
            const firstChild = node.children?.[0];
            if (firstChild && 'width' in firstChild) {
              (firstChild as Konva.Rect).width(action.previousState.width);
              (firstChild as Konva.Rect).height(action.previousState.height);
            }
            const textNode = node.findOne('Text') as Konva.Text | null;
            if (textNode && action.previousState.text !== undefined) {
              textNode.text(action.previousState.text);
              textNode.width(action.previousState.width);
              textNode.height(action.previousState.height);
            }
            layer.batchDraw();
          }
          publishUpdate(action.objectId, action.previousState);
        }
        break;
      }
    }
  }, [popUndo, publishDelete, publishCreate, publishUpdate, wireShapeEvents]);

  // Redo handler
  const handleRedo = useCallback(() => {
    const action = popRedo();
    if (!action) return;

    const stage = stageRef.current;
    const layer = objectLayerRef.current;
    if (!stage || !layer) return;

    switch (action.type) {
      case 'create': {
        // Redo create = re-create the object
        if (action.object) {
          objectsRef.current.set(action.objectId, action.object);
          const shape = createKonvaShape(action.object);
          wireShapeEvents(shape, action.objectId);
          layer.add(shape);
          layer.batchDraw();
          publishCreate(action.object);
        }
        break;
      }
      case 'delete': {
        // Redo delete = delete it again
        objectsRef.current.delete(action.objectId);
        const node = stage.findOne(`#${action.objectId}`);
        if (node) {
          node.destroy();
          layer.batchDraw();
        }
        publishDelete(action.objectId);
        setSelectedIds((prev) => prev.filter((id) => id !== action.objectId));
        break;
      }
      case 'update': {
        // Redo update = apply the new state
        if (action.object) {
          objectsRef.current.set(action.objectId, action.object);
          const node = stage.findOne(`#${action.objectId}`) as Konva.Group | null;
          if (node) {
            node.setAttrs({
              x: action.object.x,
              y: action.object.y,
              rotation: action.object.rotation,
            });
            const firstChild = node.children?.[0];
            if (firstChild && 'width' in firstChild) {
              (firstChild as Konva.Rect).width(action.object.width);
              (firstChild as Konva.Rect).height(action.object.height);
            }
            const textNode = node.findOne('Text') as Konva.Text | null;
            if (textNode && action.object.text !== undefined) {
              textNode.text(action.object.text);
              textNode.width(action.object.width);
              textNode.height(action.object.height);
            }
            layer.batchDraw();
          }
          publishUpdate(action.objectId, action.object);
        }
        break;
      }
    }
  }, [popRedo, publishDelete, publishCreate, publishUpdate, wireShapeEvents]);

  // Zoom controls (fix #6)
  const zoomTo = useCallback(
    (newScale: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
      // Zoom toward center of viewport
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const oldScale = stage.scaleX();
      const mousePointTo = {
        x: (centerX - stage.x()) / oldScale,
        y: (centerY - stage.y()) / oldScale,
      };
      stage.scale({ x: clampedScale, y: clampedScale });
      stage.position({
        x: centerX - mousePointTo.x * clampedScale,
        y: centerY - mousePointTo.y * clampedScale,
      });
      stage.batchDraw();
      syncViewport();
    },
    [dimensions, syncViewport],
  );

  const handleZoomIn = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    zoomTo(stage.scaleX() * ZOOM_FACTOR);
  }, [zoomTo]);

  const handleZoomOut = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    zoomTo(stage.scaleX() / ZOOM_FACTOR);
  }, [zoomTo]);

  const handleZoomReset = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    stage.batchDraw();
    syncViewport();
  }, [syncViewport]);

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

      // Undo: Cmd+Z (fix #4)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Cmd+Shift+Z (fix #4)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }

      // Zoom shortcuts (fix #6)
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleZoomIn();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        handleZoomReset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, editingText, deleteSelected, handleUndo, handleRedo, handleZoomIn, handleZoomOut, handleZoomReset]);

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
        draggable={activeTool === 'select' && !selectionStartRef.current}
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        onPointerMove={handlePointerMove}
        onClick={handleStageClick}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        style={{
          background: '#fafafa',
          cursor: activeTool === 'rect' ? 'crosshair' : 'default',
        }}
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

        <Layer ref={objectLayerRef}>
          {/* Rubber-band selection rectangle */}
          {selectionRect.visible && (
            <KonvaRect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              fill="rgba(66, 133, 244, 0.1)"
              stroke="#4285F4"
              strokeWidth={1}
              dash={[4, 4]}
              listening={false}
            />
          )}
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
          color={editingText.color}
          onSubmit={handleTextSubmit}
          onCancel={() => setEditingText(null)}
        />
      )}

      <ZoomControls
        scale={viewport.scale}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />

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
