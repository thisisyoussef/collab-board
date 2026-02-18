import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore/lite';
import Konva from 'konva';
import { useEffect, useRef, useState } from 'react';
import { Layer, Rect as KonvaRectShape, Stage, Transformer } from 'react-konva';
import { useNavigate, useParams } from 'react-router-dom';
import { MetricsOverlay } from '../components/MetricsOverlay';
import { PresenceAvatars } from '../components/PresenceAvatars';
import { RemoteCursors } from '../components/RemoteCursors';
import { useAuth } from '../hooks/useAuth';
import { useCursors } from '../hooks/useCursors';
import { usePresence } from '../hooks/usePresence';
import { useSocket } from '../hooks/useSocket';
import { toFirestoreUserMessage, withFirestoreTimeout } from '../lib/firestore-client';
import { db } from '../lib/firebase';
import { screenToWorld, worldToScreen } from '../lib/utils';
import type { BoardObject, BoardObjectsRecord } from '../types/board';
import type {
  ObjectCreatePayload,
  ObjectDeletePayload,
  ObjectUpdatePayload,
} from '../types/realtime';

type ActiveTool = 'select' | 'sticky' | 'rect';

interface EditingTextState {
  id: string;
  value: string;
}

interface RectDraftState {
  id: string;
  startX: number;
  startY: number;
}

interface SelectionDraftState {
  startX: number;
  startY: number;
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

type BoardCanvasNode = Konva.Group | Konva.Rect;

const STICKY_DEFAULT_WIDTH = 150;
const STICKY_DEFAULT_HEIGHT = 100;
const STICKY_DEFAULT_COLOR = '#FFEB3B';
const STICKY_PLACEHOLDER_TEXT = 'New note';
const RECT_DEFAULT_COLOR = '#E3F2FD';
const RECT_DEFAULT_STROKE = '#1565C0';
const RECT_DEFAULT_STROKE_WIDTH = 2;
const RECT_MIN_SIZE = 20;
const RECT_CLICK_DEFAULT_WIDTH = 180;
const RECT_CLICK_DEFAULT_HEIGHT = 120;
const RECT_CLICK_DRAG_THRESHOLD = 8;
const STICKY_MIN_WIDTH = 80;
const STICKY_MIN_HEIGHT = 60;
const BOARD_SAVE_DEBOUNCE_MS = 300;
const OBJECT_UPDATE_EMIT_THROTTLE_MS = 45;
const OBJECT_LATENCY_SAMPLE_WINDOW = 30;
const OBJECT_LATENCY_UI_UPDATE_MS = 120;

type PendingRemoteObjectEvent =
  | { kind: 'create'; payload: ObjectCreatePayload }
  | { kind: 'update'; payload: ObjectUpdatePayload }
  | { kind: 'delete'; payload: ObjectDeletePayload };

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

function intersects(a: Bounds, b: Bounds): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

function isPlaceholderStickyText(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  return value.trim().toLowerCase() === STICKY_PLACEHOLDER_TEXT.toLowerCase();
}

function getStickyRenderText(value: string | undefined): string {
  return isPlaceholderStickyText(value) ? STICKY_PLACEHOLDER_TEXT : value || '';
}

function getStickyRenderColor(value: string | undefined): string {
  return isPlaceholderStickyText(value) ? '#6b7280' : '#111827';
}

function normalizeLoadedObject(raw: unknown, fallbackUserId: string): BoardObject | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const candidate = raw as Partial<BoardObject>;
  if (candidate.type !== 'sticky' && candidate.type !== 'rect') {
    return null;
  }

  const width = Math.max(
    candidate.type === 'sticky' ? STICKY_MIN_WIDTH : RECT_MIN_SIZE,
    Number(candidate.width || 0),
  );
  const height = Math.max(
    candidate.type === 'sticky' ? STICKY_MIN_HEIGHT : RECT_MIN_SIZE,
    Number(candidate.height || 0),
  );

  return {
    id: String(candidate.id || crypto.randomUUID()),
    type: candidate.type,
    x: Number(candidate.x || 0),
    y: Number(candidate.y || 0),
    width,
    height,
    rotation: Number(candidate.rotation || 0),
    text: candidate.type === 'sticky' ? String(candidate.text || '') : undefined,
    color:
      typeof candidate.color === 'string' && candidate.color.trim()
        ? candidate.color
        : candidate.type === 'sticky'
          ? STICKY_DEFAULT_COLOR
          : RECT_DEFAULT_COLOR,
    stroke:
      candidate.type === 'rect'
        ? typeof candidate.stroke === 'string' && candidate.stroke.trim()
          ? candidate.stroke
          : RECT_DEFAULT_STROKE
        : undefined,
    strokeWidth:
      candidate.type === 'rect'
        ? Number(candidate.strokeWidth || RECT_DEFAULT_STROKE_WIDTH)
        : undefined,
    fontSize:
      candidate.type === 'sticky'
        ? Math.max(10, Number(candidate.fontSize || 14))
        : undefined,
    zIndex: Number(candidate.zIndex || 1),
    createdBy: String(candidate.createdBy || fallbackUserId),
    updatedAt:
      typeof candidate.updatedAt === 'string' && candidate.updatedAt
        ? candidate.updatedAt
        : new Date().toISOString(),
  };
}

function sanitizeBoardObjectForFirestore(entry: BoardObject): BoardObject {
  if (entry.type === 'sticky') {
    return {
      id: entry.id,
      type: 'sticky',
      x: entry.x,
      y: entry.y,
      width: entry.width,
      height: entry.height,
      rotation: entry.rotation,
      text: entry.text || '',
      color: entry.color,
      fontSize: entry.fontSize || 14,
      zIndex: entry.zIndex,
      createdBy: entry.createdBy || 'guest',
      updatedAt: entry.updatedAt,
    };
  }

  return {
    id: entry.id,
    type: 'rect',
    x: entry.x,
    y: entry.y,
    width: entry.width,
    height: entry.height,
    rotation: entry.rotation,
    color: entry.color,
    stroke: entry.stroke || RECT_DEFAULT_STROKE,
    strokeWidth: entry.strokeWidth || RECT_DEFAULT_STROKE_WIDTH,
    zIndex: entry.zIndex,
    createdBy: entry.createdBy || 'guest',
    updatedAt: entry.updatedAt,
  };
}

export function Board() {
  const { id: boardId } = useParams<{ id: string }>();
  const { user, signOut } = useAuth();
  const { socketRef, status: socketStatus } = useSocket(boardId);
  const { members } = usePresence({ boardId, user, socketRef, socketStatus });
  const { remoteCursors, averageLatencyMs, publishCursor, publishCursorHide } = useCursors({
    boardId,
    user,
    socketRef,
    socketStatus,
  });
  const navigate = useNavigate();

  const displayName = user?.displayName || user?.email || 'Guest';
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const objectsLayerRef = useRef<Konva.Layer | null>(null);
  const selectionLayerRef = useRef<Konva.Layer | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const selectionRectRef = useRef<Konva.Rect | null>(null);
  const objectsRef = useRef<Map<string, BoardObject>>(new Map());
  const saveTimeoutRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const hasUnsavedChangesRef = useRef(false);
  const rectDraftRef = useRef<RectDraftState | null>(null);
  const selectionDraftRef = useRef<SelectionDraftState | null>(null);
  const boardIdRef = useRef<string | undefined>(boardId);
  const realtimeObjectEmitAtRef = useRef<Record<string, number>>({});
  const hasInitialBoardLoadRef = useRef(false);
  const pendingRemoteObjectEventsRef = useRef<PendingRemoteObjectEvent[]>([]);
  const objectLatencySamplesRef = useRef<number[]>([]);
  const lastObjectLatencyUiUpdateAtRef = useRef(0);

  const [canvasSize, setCanvasSize] = useState({ width: 960, height: 560 });
  const [boardTitle, setBoardTitle] = useState('Untitled board');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('Untitled board');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [canvasNotice, setCanvasNotice] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [boardRevision, setBoardRevision] = useState(0);
  const [objectCount, setObjectCount] = useState(0);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [editingText, setEditingText] = useState<EditingTextState | null>(null);
  const [isDrawingRect, setIsDrawingRect] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [averageObjectLatencyMs, setAverageObjectLatencyMs] = useState(0);

  const selectedObject =
    selectedIds.length === 1 ? objectsRef.current.get(selectedIds[0]) ?? null : null;

  const textEditorLayout = (() => {
    if (!editingText) {
      return null;
    }

    const stage = stageRef.current;
    const object = objectsRef.current.get(editingText.id);
    if (!stage || !object || object.type !== 'sticky') {
      return null;
    }

    const point = worldToScreen(stage, { x: object.x, y: object.y });
    const scale = stage.scaleX() || 1;

    return {
      left: point.x,
      top: point.y,
      width: Math.max(80, object.width * scale),
      height: Math.max(60, object.height * scale),
      fontSize: Math.max(12, (object.fontSize || 14) * scale),
    };
  })();

  useEffect(() => {
    boardIdRef.current = boardId;
    hasInitialBoardLoadRef.current = false;
    pendingRemoteObjectEventsRef.current = [];
    objectLatencySamplesRef.current = [];
    lastObjectLatencyUiUpdateAtRef.current = 0;
    setAverageObjectLatencyMs(0);
  }, [boardId]);

  useEffect(
    () => () => {
      clearPersistenceTimer();
      flushBoardSave();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!boardId) {
      return;
    }

    let cancelled = false;

    const loadBoardTitle = async () => {
      try {
        const snapshot = await withFirestoreTimeout(
          'Loading board title',
          getDoc(doc(db, 'boards', boardId)),
        );
        if (cancelled) {
          return;
        }

        if (!snapshot.exists()) {
          setTitleError('Board not found.');
          return;
        }

        const nextTitle = (snapshot.data() as { title?: string }).title?.trim() || 'Untitled board';
        setTitleDraft(nextTitle);
        setBoardTitle(nextTitle);
        setTitleError(null);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setTitleError(toFirestoreUserMessage('Unable to load board title.', err));
      }
    };

    void loadBoardTitle();
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  useEffect(() => {
    if (!boardId) {
      return;
    }

    let cancelled = false;

    const loadBoardObjects = async () => {
      try {
        const snapshot = await withFirestoreTimeout(
          'Loading board objects',
          getDoc(doc(db, 'boards', boardId)),
        );

        if (cancelled) {
          return;
        }

        if (!snapshot.exists()) {
          setCanvasNotice('Board not found.');
          clearBoardObjects();
          hasInitialBoardLoadRef.current = true;
          pendingRemoteObjectEventsRef.current = [];
          return;
        }

        clearBoardObjects();

        const rawObjects = (snapshot.data() as { objects?: BoardObjectsRecord }).objects || {};
        const normalizedObjects = Object.values(rawObjects)
          .map((entry) => normalizeLoadedObject(entry, user?.uid || 'guest'))
          .filter((entry): entry is BoardObject => Boolean(entry))
          .sort((a, b) => a.zIndex - b.zIndex);

        normalizedObjects.forEach((entry) => {
          objectsRef.current.set(entry.id, entry);
          const node = createNodeForObject(entry);
          objectsLayerRef.current?.add(node);
          node.zIndex(entry.zIndex);
        });

        objectsLayerRef.current?.batchDraw();
        setObjectCount(objectsRef.current.size);
        hasUnsavedChangesRef.current = false;
        setCanvasNotice(null);
        setBoardRevision((value) => value + 1);
        hasInitialBoardLoadRef.current = true;
        flushPendingRemoteObjectEvents();
      } catch (err) {
        if (cancelled) {
          return;
        }
        setCanvasNotice(toFirestoreUserMessage('Unable to load board objects.', err));
      }
    };

    void loadBoardObjects();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, user]);

  useEffect(() => {
    const measure = () => {
      const container = canvasContainerRef.current;
      if (!container) {
        return;
      }

      const next = {
        width: Math.max(container.clientWidth, 320),
        height: Math.max(container.clientHeight, 220),
      };

      setCanvasSize((previous) =>
        previous.width === next.width && previous.height === next.height ? previous : next,
      );
    };

    const frameId = window.requestAnimationFrame(measure);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        measure();
      });

      if (canvasContainerRef.current) {
        observer.observe(canvasContainerRef.current);
      }
    }

    window.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) {
      return;
    }

    const nodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter((node): node is Konva.Node => Boolean(node));

    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, boardRevision]);

  useEffect(() => {
    objectsRef.current.forEach((_, id) => {
      const node = stageRef.current?.findOne(`#${id}`);
      if (!node) {
        return;
      }

      node.draggable(activeTool === 'select' && !editingText);
    });
  }, [activeTool, editingText, boardRevision]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedIds.length === 0) {
          return;
        }
        event.preventDefault();
        removeObjects(selectedIds, true);
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'v') {
        setActiveTool('select');
        return;
      }

      if (key === 's') {
        setActiveTool('sticky');
        return;
      }

      if (key === 'r') {
        setActiveTool('rect');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  useEffect(() => {
    if (!boardId) {
      return;
    }

    const handlePageHide = () => {
      flushBoardSave();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushBoardSave();
      }
    };

    window.addEventListener('beforeunload', handlePageHide);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handlePageHide);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, user]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !boardId || socketStatus !== 'connected') {
      return;
    }

    const handleRemoteCreate = (payload: ObjectCreatePayload) => {
      const changedBoardId =
        typeof payload?.boardId === 'string' ? payload.boardId.trim() : '';
      if (!changedBoardId || changedBoardId !== boardId) {
        return;
      }

      if (!hasInitialBoardLoadRef.current) {
        enqueueRemoteObjectEvent({ kind: 'create', payload });
        return;
      }

      const normalized = normalizeLoadedObject(payload.object, 'guest');
      if (!normalized) {
        return;
      }

      recordRemoteObjectLatency(payload._ts);
      applyRemoteObjectUpsert(normalized, payload._ts);
    };

    const handleRemoteUpdate = (payload: ObjectUpdatePayload) => {
      const changedBoardId =
        typeof payload?.boardId === 'string' ? payload.boardId.trim() : '';
      if (!changedBoardId || changedBoardId !== boardId) {
        return;
      }

      if (!hasInitialBoardLoadRef.current) {
        enqueueRemoteObjectEvent({ kind: 'update', payload });
        return;
      }

      const normalized = normalizeLoadedObject(payload.object, 'guest');
      if (!normalized) {
        return;
      }

      recordRemoteObjectLatency(payload._ts);
      applyRemoteObjectUpsert(normalized, payload._ts);
    };

    const handleRemoteDelete = (payload: ObjectDeletePayload) => {
      const changedBoardId =
        typeof payload?.boardId === 'string' ? payload.boardId.trim() : '';
      if (!changedBoardId || changedBoardId !== boardId) {
        return;
      }

      if (!hasInitialBoardLoadRef.current) {
        enqueueRemoteObjectEvent({ kind: 'delete', payload });
        return;
      }

      const objectId = typeof payload?.objectId === 'string' ? payload.objectId.trim() : '';
      if (!objectId) {
        return;
      }

      recordRemoteObjectLatency(payload._ts);
      applyRemoteObjectDelete(objectId, payload._ts);
    };

    socket.on('object:create', handleRemoteCreate);
    socket.on('object:update', handleRemoteUpdate);
    socket.on('object:delete', handleRemoteDelete);

    return () => {
      socket.off('object:create', handleRemoteCreate);
      socket.off('object:update', handleRemoteUpdate);
      socket.off('object:delete', handleRemoteDelete);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, socketRef, socketStatus]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !boardId || socketStatus !== 'connected') {
      return;
    }

    const handleBoardChanged = (payload: { boardId: string }) => {
      const changedBoardId =
        typeof payload?.boardId === 'string' ? payload.boardId.trim() : '';
      if (!changedBoardId || changedBoardId !== boardId) {
        return;
      }

      if (
        hasUnsavedChangesRef.current ||
        saveInFlightRef.current ||
        rectDraftRef.current ||
        selectionDraftRef.current ||
        editingText
      ) {
        return;
      }

      void (async () => {
        try {
          const snapshot = await withFirestoreTimeout(
            'Loading board objects',
            getDoc(doc(db, 'boards', boardId)),
          );
          if (!snapshot.exists()) {
            return;
          }

          const rawObjects = (snapshot.data() as { objects?: BoardObjectsRecord }).objects || {};
          clearBoardObjects();

          const normalizedObjects = Object.values(rawObjects)
            .map((entry) => normalizeLoadedObject(entry, user?.uid || 'guest'))
            .filter((entry): entry is BoardObject => Boolean(entry))
            .sort((a, b) => a.zIndex - b.zIndex);

          normalizedObjects.forEach((entry) => {
            objectsRef.current.set(entry.id, entry);
            const node = createNodeForObject(entry);
            objectsLayerRef.current?.add(node);
            node.zIndex(entry.zIndex);
          });

          objectsLayerRef.current?.batchDraw();
          setObjectCount(objectsRef.current.size);
          hasUnsavedChangesRef.current = false;
          setBoardRevision((value) => value + 1);
        } catch {
          // keep local state if background sync fetch fails
        }
      })();
    };

    socket.on('board:changed', handleBoardChanged);
    return () => {
      socket.off('board:changed', handleBoardChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, editingText, socketRef, socketStatus, user]);

  function isBackgroundTarget(target: Konva.Node | null, stage: Konva.Stage): boolean {
    return target === stage || Boolean(target?.hasName('board-background'));
  }

  function getWorldPointerPosition(): { x: number; y: number } | null {
    const stage = stageRef.current;
    if (!stage) {
      return null;
    }

    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return null;
    }

    return screenToWorld(stage, pointer);
  }

  function clearPersistenceTimer() {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }

  function emitObjectCreate(object: BoardObject) {
    const liveBoardId = boardIdRef.current;
    const socket = socketRef.current;
    if (!liveBoardId || !socket?.connected) {
      return;
    }

    const now = Date.now();
    const payloadObject = sanitizeBoardObjectForFirestore(object);
    realtimeObjectEmitAtRef.current[payloadObject.id] = now;
    socket.emit('object:create', {
      boardId: liveBoardId,
      object: payloadObject,
      _ts: now,
    });
  }

  function emitObjectUpdate(object: BoardObject, force = false) {
    const liveBoardId = boardIdRef.current;
    const socket = socketRef.current;
    if (!liveBoardId || !socket?.connected) {
      return;
    }

    const now = Date.now();
    const lastEmitted = realtimeObjectEmitAtRef.current[object.id] || 0;
    if (!force && now - lastEmitted < OBJECT_UPDATE_EMIT_THROTTLE_MS) {
      return;
    }

    const payloadObject = sanitizeBoardObjectForFirestore(object);
    realtimeObjectEmitAtRef.current[payloadObject.id] = now;

    const payload = {
      boardId: liveBoardId,
      object: payloadObject,
      _ts: now,
    };

    socket.emit('object:update', payload);
  }

  function emitObjectDelete(objectId: string) {
    const liveBoardId = boardIdRef.current;
    const socket = socketRef.current;
    if (!liveBoardId || !socket?.connected) {
      return;
    }

    delete realtimeObjectEmitAtRef.current[objectId];
    socket.emit('object:delete', {
      boardId: liveBoardId,
      objectId,
      _ts: Date.now(),
    });
  }

  function serializeBoardObjects(): BoardObjectsRecord {
    const objectsRecord: BoardObjectsRecord = {};
    objectsRef.current.forEach((entry, id) => {
      objectsRecord[id] = sanitizeBoardObjectForFirestore(entry);
    });
    return objectsRecord;
  }

  async function persistBoardSave() {
    const liveBoardId = boardIdRef.current;
    if (!liveBoardId || !hasUnsavedChangesRef.current) {
      return;
    }

    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return;
    }

    saveInFlightRef.current = true;
    const objectsRecord = serializeBoardObjects();

    try {
      await withFirestoreTimeout(
        'Saving board changes',
        updateDoc(doc(db, 'boards', liveBoardId), {
          objects: objectsRecord,
          updatedAt: serverTimestamp(),
        }),
      );
      hasUnsavedChangesRef.current = false;
      setCanvasNotice(null);
      const socket = socketRef.current;
      if (socket?.connected) {
        socket.emit('board:changed', {
          boardId: liveBoardId,
          _ts: Date.now(),
        });
      }
    } catch (err) {
      hasUnsavedChangesRef.current = true;
      setCanvasNotice(toFirestoreUserMessage('Unable to save board changes.', err));
    } finally {
      saveInFlightRef.current = false;
      if (saveQueuedRef.current) {
        saveQueuedRef.current = false;
        void persistBoardSave();
      }
    }
  }

  function scheduleBoardSave() {
    hasUnsavedChangesRef.current = true;
    clearPersistenceTimer();
    saveTimeoutRef.current = window.setTimeout(() => {
      void persistBoardSave();
    }, BOARD_SAVE_DEBOUNCE_MS);
  }

  function flushBoardSave() {
    clearPersistenceTimer();
    if (!hasUnsavedChangesRef.current) {
      return;
    }
    void persistBoardSave();
  }

  function clearBoardObjects() {
    objectsLayerRef.current?.destroyChildren();
    objectsLayerRef.current?.batchDraw();
    objectsRef.current.clear();
    hasUnsavedChangesRef.current = false;
    setObjectCount(0);
    setSelectedIds([]);
    setEditingText(null);
  }

  function parseUpdatedAtMs(value: string | undefined): number {
    const ms = Date.parse(String(value || ''));
    return Number.isFinite(ms) ? ms : 0;
  }

  function recordRemoteObjectLatency(sentAt: number | undefined) {
    if (!Number.isFinite(sentAt)) {
      return;
    }

    const latency = Math.max(0, Date.now() - Number(sentAt));
    const next = [...objectLatencySamplesRef.current, latency].slice(-OBJECT_LATENCY_SAMPLE_WINDOW);
    objectLatencySamplesRef.current = next;

    const now = Date.now();
    if (now - lastObjectLatencyUiUpdateAtRef.current < OBJECT_LATENCY_UI_UPDATE_MS) {
      return;
    }

    lastObjectLatencyUiUpdateAtRef.current = now;
    const average = next.reduce((sum, value) => sum + value, 0) / next.length;
    setAverageObjectLatencyMs(Math.round(average));
  }

  function applyRemoteObjectUpsert(entry: BoardObject, eventTs?: number): boolean {
    const normalized = sanitizeBoardObjectForFirestore(entry);
    const existing = objectsRef.current.get(normalized.id);

    if (existing) {
      const localUpdatedAtMs = parseUpdatedAtMs(existing.updatedAt);
      const remoteUpdatedAtMs = parseUpdatedAtMs(normalized.updatedAt);
      if (remoteUpdatedAtMs && localUpdatedAtMs && remoteUpdatedAtMs <= localUpdatedAtMs) {
        return false;
      }

      if (Number.isFinite(eventTs) && localUpdatedAtMs && Number(eventTs) < localUpdatedAtMs) {
        return false;
      }
    }

    const existingNode = stageRef.current?.findOne(`#${normalized.id}`);

    let node: BoardCanvasNode | null = null;
    if (
      existingNode &&
      ((normalized.type === 'sticky' && existingNode instanceof Konva.Group) ||
        (normalized.type === 'rect' && existingNode instanceof Konva.Rect))
    ) {
      node = existingNode as BoardCanvasNode;
    } else if (existingNode) {
      existingNode.destroy();
    }

    if (!node) {
      node = createNodeForObject(normalized);
      objectsLayerRef.current?.add(node);
    }

    if (normalized.type === 'sticky' && node instanceof Konva.Group) {
      node.setAttrs({
        x: normalized.x,
        y: normalized.y,
        rotation: normalized.rotation,
      });

      const body = node.findOne('.sticky-body') as Konva.Rect | null;
      const label = node.findOne('.sticky-label') as Konva.Text | null;
      body?.setAttrs({
        width: normalized.width,
        height: normalized.height,
        fill: normalized.color,
      });
      label?.setAttrs({
        text: getStickyRenderText(normalized.text),
        fill: getStickyRenderColor(normalized.text),
        width: normalized.width,
        height: normalized.height,
        fontSize: normalized.fontSize || 14,
      });
    }

    if (normalized.type === 'rect' && node instanceof Konva.Rect) {
      node.setAttrs({
        x: normalized.x,
        y: normalized.y,
        width: normalized.width,
        height: normalized.height,
        rotation: normalized.rotation,
        fill: normalized.color,
        stroke: normalized.stroke || RECT_DEFAULT_STROKE,
        strokeWidth: normalized.strokeWidth || RECT_DEFAULT_STROKE_WIDTH,
      });
    }

    node.zIndex(normalized.zIndex);
    objectsRef.current.set(normalized.id, normalized);
    objectsLayerRef.current?.batchDraw();
    if (!existing) {
      setObjectCount(objectsRef.current.size);
    }

    setBoardRevision((value) => value + 1);
    return true;
  }

  function applyRemoteObjectDelete(objectId: string, eventTs?: number): boolean {
    const object = objectsRef.current.get(objectId);
    if (!object) {
      return false;
    }

    const localUpdatedAtMs = parseUpdatedAtMs(object.updatedAt);
    if (Number.isFinite(eventTs) && localUpdatedAtMs && Number(eventTs) < localUpdatedAtMs) {
      return false;
    }

    const node = stageRef.current?.findOne(`#${objectId}`);
    node?.destroy();
    objectsRef.current.delete(objectId);
    objectsLayerRef.current?.batchDraw();
    setObjectCount(objectsRef.current.size);
    setSelectedIds((previous) => previous.filter((entry) => entry !== objectId));
    setEditingText((previous) => (previous?.id === objectId ? null : previous));
    setBoardRevision((value) => value + 1);
    return true;
  }

  function enqueueRemoteObjectEvent(event: PendingRemoteObjectEvent) {
    pendingRemoteObjectEventsRef.current.push(event);
  }

  function flushPendingRemoteObjectEvents() {
    if (!hasInitialBoardLoadRef.current || pendingRemoteObjectEventsRef.current.length === 0) {
      return;
    }

    const queue = pendingRemoteObjectEventsRef.current;
    pendingRemoteObjectEventsRef.current = [];

    queue.forEach((event) => {
      if (event.kind === 'create') {
        const normalized = normalizeLoadedObject(event.payload.object, 'guest');
        if (normalized) {
          recordRemoteObjectLatency(event.payload._ts);
          applyRemoteObjectUpsert(normalized, event.payload._ts);
        }
        return;
      }

      if (event.kind === 'update') {
        const normalized = normalizeLoadedObject(event.payload.object, 'guest');
        if (normalized) {
          recordRemoteObjectLatency(event.payload._ts);
          applyRemoteObjectUpsert(normalized, event.payload._ts);
        }
        return;
      }

      recordRemoteObjectLatency(event.payload._ts);
      applyRemoteObjectDelete(event.payload.objectId, event.payload._ts);
    });
  }

  function getNextZIndex(): number {
    let max = 0;
    objectsRef.current.forEach((entry) => {
      max = Math.max(max, entry.zIndex);
    });
    return max + 1;
  }

  function applyStickyTransform(node: Konva.Group, object: BoardObject) {
    const scaleX = node.scaleX() || 1;
    const scaleY = node.scaleY() || 1;
    const width = Math.max(STICKY_MIN_WIDTH, object.width * scaleX);
    const height = Math.max(STICKY_MIN_HEIGHT, object.height * scaleY);

    const body = node.findOne('.sticky-body') as Konva.Rect | null;
    const label = node.findOne('.sticky-label') as Konva.Text | null;

    body?.setAttrs({ width, height });
    label?.setAttrs({ width, height });
    node.scale({ x: 1, y: 1 });
  }

  function applyRectTransform(node: Konva.Rect, object: BoardObject) {
    const scaleX = node.scaleX() || 1;
    const scaleY = node.scaleY() || 1;
    const width = Math.max(RECT_MIN_SIZE, node.width() * scaleX || object.width * scaleX);
    const height = Math.max(RECT_MIN_SIZE, node.height() * scaleY || object.height * scaleY);

    node.width(width);
    node.height(height);
    node.scale({ x: 1, y: 1 });
  }

  function syncObjectFromNode(
    objectId: string,
    persist: boolean,
    emitRealtime = persist,
    bumpRevision = true,
  ) {
    const current = objectsRef.current.get(objectId);
    const node = stageRef.current?.findOne(`#${objectId}`);
    if (!current || !node) {
      return;
    }

    let width = current.width;
    let height = current.height;

    if (current.type === 'sticky' && node instanceof Konva.Group) {
      const body = node.findOne('.sticky-body') as Konva.Rect | null;
      if (body) {
        width = body.width();
        height = body.height();
      }
    }

    if (current.type === 'rect' && node instanceof Konva.Rect) {
      width = node.width();
      height = node.height();
    }

    const nextObject: BoardObject = {
      ...current,
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      width,
      height,
      updatedAt: persist ? new Date().toISOString() : current.updatedAt,
    };

    objectsRef.current.set(objectId, nextObject);

    if (bumpRevision) {
      setBoardRevision((value) => value + 1);
    }
    if (emitRealtime) {
      emitObjectUpdate(nextObject, persist);
    }
    if (persist) {
      scheduleBoardSave();
    }
  }

  function openTextEditor(objectId: string) {
    const object = objectsRef.current.get(objectId);
    if (!object || object.type !== 'sticky') {
      return;
    }

    setEditingText({
      id: objectId,
      value: isPlaceholderStickyText(object.text) ? '' : object.text || '',
    });
  }

  function handleObjectSelection(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>, objectId: string) {
    event.cancelBubble = true;
    const nativeEvent = event.evt as MouseEvent;
    const isShift = Boolean(nativeEvent?.shiftKey);

    setSelectedIds((previous) => {
      if (!isShift) {
        return [objectId];
      }

      if (previous.includes(objectId)) {
        return previous.filter((entry) => entry !== objectId);
      }

      return [...previous, objectId];
    });
  }

  function createStickyNode(object: BoardObject): Konva.Group {
    const group = new Konva.Group({
      id: object.id,
      name: 'board-object sticky-object',
      x: object.x,
      y: object.y,
      rotation: object.rotation,
      draggable: false,
    });

    const body = new Konva.Rect({
      name: 'sticky-body',
      width: object.width,
      height: object.height,
      fill: object.color,
      cornerRadius: 4,
      shadowBlur: 4,
      shadowOpacity: 0.15,
      shadowOffset: { x: 0, y: 2 },
    });

    const label = new Konva.Text({
      name: 'sticky-label',
      text: getStickyRenderText(object.text),
      width: object.width,
      height: object.height,
      fill: getStickyRenderColor(object.text),
      fontSize: object.fontSize || 14,
      fontFamily: 'Segoe UI, sans-serif',
      padding: 8,
      align: 'left',
      verticalAlign: 'top',
      lineHeight: 1.35,
      wrap: 'word',
    });

    group.add(body);
    group.add(label);

    group.on('click tap', (event) => {
      handleObjectSelection(event, object.id);
    });
    group.on('dragmove', () => {
      syncObjectFromNode(object.id, false, true, false);
      const worldPosition = getWorldPointerPosition();
      if (worldPosition) {
        publishCursor(worldPosition);
      }
    });
    group.on('dragend', () => {
      syncObjectFromNode(object.id, true);
    });
    group.on('transformend', () => {
      const existing = objectsRef.current.get(object.id);
      if (!existing) {
        return;
      }

      applyStickyTransform(group, existing);
      syncObjectFromNode(object.id, true);
      objectsLayerRef.current?.batchDraw();
    });
    group.on('dblclick dbltap', () => {
      openTextEditor(object.id);
    });

    return group;
  }

  function createRectNode(object: BoardObject): Konva.Rect {
    const rect = new Konva.Rect({
      id: object.id,
      name: 'board-object rect-object',
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
      fill: object.color,
      stroke: object.stroke || RECT_DEFAULT_STROKE,
      strokeWidth: object.strokeWidth || RECT_DEFAULT_STROKE_WIDTH,
      rotation: object.rotation,
      draggable: false,
    });

    rect.on('click tap', (event) => {
      handleObjectSelection(event, object.id);
    });
    rect.on('dragmove', () => {
      syncObjectFromNode(object.id, false, true, false);
      const worldPosition = getWorldPointerPosition();
      if (worldPosition) {
        publishCursor(worldPosition);
      }
    });
    rect.on('dragend', () => {
      syncObjectFromNode(object.id, true);
    });
    rect.on('transformend', () => {
      const existing = objectsRef.current.get(object.id);
      if (!existing) {
        return;
      }

      applyRectTransform(rect, existing);
      syncObjectFromNode(object.id, true);
      objectsLayerRef.current?.batchDraw();
    });

    return rect;
  }

  function createNodeForObject(object: BoardObject): BoardCanvasNode {
    return object.type === 'sticky' ? createStickyNode(object) : createRectNode(object);
  }

  function insertObject(object: BoardObject, persist: boolean) {
    objectsRef.current.set(object.id, object);
    const node = createNodeForObject(object);
    objectsLayerRef.current?.add(node);
    node.zIndex(object.zIndex);
    objectsLayerRef.current?.batchDraw();
    setObjectCount(objectsRef.current.size);
    setBoardRevision((value) => value + 1);

    if (persist) {
      emitObjectCreate(object);
      scheduleBoardSave();
    }
  }

  function removeObjects(objectIds: string[], persist: boolean) {
    if (objectIds.length === 0) {
      return;
    }

    const removeSet = new Set(objectIds);
    objectIds.forEach((objectId) => {
      const node = stageRef.current?.findOne(`#${objectId}`);
      node?.destroy();
      objectsRef.current.delete(objectId);
    });

    objectsLayerRef.current?.batchDraw();
    setSelectedIds((previous) => previous.filter((entry) => !removeSet.has(entry)));
    setObjectCount(objectsRef.current.size);
    setEditingText((previous) => (previous && removeSet.has(previous.id) ? null : previous));
    setBoardRevision((value) => value + 1);

    if (persist) {
      objectIds.forEach((objectId) => {
        emitObjectDelete(objectId);
      });
      scheduleBoardSave();
    }
  }

  function commitTextEdit(saveChanges: boolean) {
    if (!editingText) {
      return;
    }

    const current = objectsRef.current.get(editingText.id);
    if (!current || current.type !== 'sticky') {
      setEditingText(null);
      return;
    }

    const group = stageRef.current?.findOne(`#${editingText.id}`) as Konva.Group | null;
    const label = group?.findOne('.sticky-label') as Konva.Text | null;
    const text = editingText.value;
    const normalizedText = text.replace(/\r\n/g, '\n');
    const nextText = saveChanges ? normalizedText : current.text || '';

    const nextObject: BoardObject = {
      ...current,
      text: nextText,
      updatedAt: saveChanges ? new Date().toISOString() : current.updatedAt,
    };

    objectsRef.current.set(editingText.id, nextObject);

    label?.text(getStickyRenderText(nextText));
    label?.fill(getStickyRenderColor(nextText));
    objectsLayerRef.current?.batchDraw();
    setEditingText(null);
    setBoardRevision((value) => value + 1);

    if (saveChanges) {
      emitObjectUpdate(nextObject, true);
      scheduleBoardSave();
    }
  }

  function createStickyAt(worldPosition: { x: number; y: number }) {
    const object: BoardObject = {
      id: crypto.randomUUID(),
      type: 'sticky',
      x: worldPosition.x,
      y: worldPosition.y,
      width: STICKY_DEFAULT_WIDTH,
      height: STICKY_DEFAULT_HEIGHT,
      rotation: 0,
      text: '',
      color: STICKY_DEFAULT_COLOR,
      fontSize: 14,
      zIndex: getNextZIndex(),
      createdBy: user?.uid || 'guest',
      updatedAt: new Date().toISOString(),
    };

    insertObject(object, true);
    setSelectedIds([object.id]);
    setActiveTool('select');
  }

  function beginRectDraft(worldPosition: { x: number; y: number }) {
    const object: BoardObject = {
      id: crypto.randomUUID(),
      type: 'rect',
      x: worldPosition.x,
      y: worldPosition.y,
      width: 1,
      height: 1,
      rotation: 0,
      color: RECT_DEFAULT_COLOR,
      stroke: RECT_DEFAULT_STROKE,
      strokeWidth: RECT_DEFAULT_STROKE_WIDTH,
      zIndex: getNextZIndex(),
      createdBy: user?.uid || 'guest',
      updatedAt: new Date().toISOString(),
    };

    insertObject(object, false);
    rectDraftRef.current = {
      id: object.id,
      startX: worldPosition.x,
      startY: worldPosition.y,
    };
    setIsDrawingRect(true);
    setSelectedIds([object.id]);
  }

  function updateRectDraft(worldPosition: { x: number; y: number }) {
    const draft = rectDraftRef.current;
    if (!draft) {
      return;
    }

    const current = objectsRef.current.get(draft.id);
    const rectNode = stageRef.current?.findOne(`#${draft.id}`) as Konva.Rect | null;
    if (!current || !rectNode) {
      return;
    }

    const x = Math.min(draft.startX, worldPosition.x);
    const y = Math.min(draft.startY, worldPosition.y);
    const width = Math.max(1, Math.abs(worldPosition.x - draft.startX));
    const height = Math.max(1, Math.abs(worldPosition.y - draft.startY));

    rectNode.setAttrs({ x, y, width, height });
    objectsRef.current.set(draft.id, {
      ...current,
      x,
      y,
      width,
      height,
    });
    objectsLayerRef.current?.batchDraw();
  }

  function finalizeRectDraft() {
    const draft = rectDraftRef.current;
    if (!draft) {
      return;
    }

    const current = objectsRef.current.get(draft.id);
    const rectNode = stageRef.current?.findOne(`#${draft.id}`) as Konva.Rect | null;
    if (!current || !rectNode) {
      rectDraftRef.current = null;
      setIsDrawingRect(false);
      return;
    }

    const isClickCreate =
      current.width < RECT_CLICK_DRAG_THRESHOLD && current.height < RECT_CLICK_DRAG_THRESHOLD;
    const width = isClickCreate ? RECT_CLICK_DEFAULT_WIDTH : Math.max(RECT_MIN_SIZE, current.width);
    const height = isClickCreate
      ? RECT_CLICK_DEFAULT_HEIGHT
      : Math.max(RECT_MIN_SIZE, current.height);
    rectNode.setAttrs({ width, height });

    const finalizedObject: BoardObject = {
      ...current,
      width,
      height,
      updatedAt: new Date().toISOString(),
    };
    objectsRef.current.set(draft.id, finalizedObject);

    rectDraftRef.current = null;
    setIsDrawingRect(false);
    setActiveTool('select');
    setSelectedIds([draft.id]);
    setBoardRevision((value) => value + 1);
    emitObjectCreate(finalizedObject);
    scheduleBoardSave();
    objectsLayerRef.current?.batchDraw();
  }

  function beginSelection(worldPosition: { x: number; y: number }) {
    selectionDraftRef.current = {
      startX: worldPosition.x,
      startY: worldPosition.y,
    };

    const selectionRect = selectionRectRef.current;
    selectionRect?.setAttrs({
      x: worldPosition.x,
      y: worldPosition.y,
      width: 0,
      height: 0,
      visible: true,
    });
    selectionLayerRef.current?.batchDraw();
    setIsSelecting(true);
  }

  function updateSelection(worldPosition: { x: number; y: number }) {
    const draft = selectionDraftRef.current;
    const selectionRect = selectionRectRef.current;
    if (!draft || !selectionRect) {
      return;
    }

    const x = Math.min(draft.startX, worldPosition.x);
    const y = Math.min(draft.startY, worldPosition.y);
    const width = Math.abs(worldPosition.x - draft.startX);
    const height = Math.abs(worldPosition.y - draft.startY);

    selectionRect.setAttrs({ x, y, width, height, visible: true });
    selectionLayerRef.current?.batchDraw();
  }

  function finalizeSelection() {
    const selectionRect = selectionRectRef.current;
    if (!selectionRect) {
      selectionDraftRef.current = null;
      setIsSelecting(false);
      return;
    }

    const bounds = selectionRect.getAttrs() as Bounds;
    const nextSelected: string[] = [];

    objectsRef.current.forEach((entry) => {
      const objectBounds: Bounds = {
        x: entry.x,
        y: entry.y,
        width: entry.width,
        height: entry.height,
      };

      if (intersects(bounds, objectBounds)) {
        nextSelected.push(entry.id);
      }
    });

    selectionRect.visible(false);
    selectionLayerRef.current?.batchDraw();
    selectionDraftRef.current = null;
    setSelectedIds(nextSelected);
    setIsSelecting(false);
  }

  function handleStageMouseDown(
    event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  ) {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const target = event.target;
    const worldPosition = getWorldPointerPosition();
    if (!worldPosition) {
      return;
    }

    const backgroundTarget = isBackgroundTarget(target, stage);
    if (!backgroundTarget) {
      return;
    }

    if (activeTool === 'sticky') {
      createStickyAt(worldPosition);
      return;
    }

    if (activeTool === 'rect') {
      beginRectDraft(worldPosition);
      return;
    }

    const mouseEvent = event.evt as MouseEvent;
    if (activeTool === 'select' && mouseEvent.shiftKey) {
      beginSelection(worldPosition);
    }
  }

  function handleStageMouseMove() {
    const worldPosition = getWorldPointerPosition();
    if (!worldPosition) {
      return;
    }

    publishCursor(worldPosition);

    if (rectDraftRef.current) {
      updateRectDraft(worldPosition);
    }

    if (selectionDraftRef.current) {
      updateSelection(worldPosition);
    }
  }

  function handleStageMouseUp() {
    if (rectDraftRef.current) {
      finalizeRectDraft();
    }

    if (selectionDraftRef.current) {
      finalizeSelection();
    }
  }

  function handleStageMouseLeave() {
    publishCursorHide();

    if (rectDraftRef.current) {
      finalizeRectDraft();
    }

    if (selectionDraftRef.current) {
      finalizeSelection();
    }
  }

  function handleStageClick(
    event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  ) {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    if (activeTool !== 'select') {
      return;
    }

    const target = event.target;
    if (!isBackgroundTarget(target, stage)) {
      return;
    }

    const mouseEvent = event.evt as MouseEvent;
    if (mouseEvent.shiftKey || selectionDraftRef.current || rectDraftRef.current) {
      return;
    }

    setSelectedIds([]);
  }

  function handleStageWheel(event: Konva.KonvaEventObject<WheelEvent>) {
    event.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }

    const oldScale = stage.scaleX() || 1;
    const zoomFactor = 1.08;
    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const rawScale = direction > 0 ? oldScale * zoomFactor : oldScale / zoomFactor;
    const newScale = Math.max(0.1, Math.min(5, rawScale));

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });

    stage.batchDraw();
    setZoomPercent(Math.round(newScale * 100));
    setBoardRevision((value) => value + 1);
  }

  const handleSaveTitle = async () => {
    if (!boardId) {
      return;
    }

    const cleaned = titleDraft.trim();
    if (!cleaned) {
      setTitleError('Board name cannot be empty.');
      return;
    }

    if (cleaned === boardTitle) {
      setEditingTitle(false);
      return;
    }

    setIsSavingTitle(true);
    try {
      await withFirestoreTimeout(
        'Saving board title',
        updateDoc(doc(db, 'boards', boardId), {
          title: cleaned,
          updatedAt: serverTimestamp(),
        }),
      );
      setBoardTitle(cleaned);
      setTitleDraft(cleaned);
      setEditingTitle(false);
      setTitleError(null);
    } catch (err) {
      setTitleError(toFirestoreUserMessage('Failed to save board title.', err));
    } finally {
      setIsSavingTitle(false);
    }
  };

  if (!boardId) {
    return <div className="centered-screen">Board unavailable.</div>;
  }

  const socketStatusLabel =
    socketStatus === 'connected'
      ? '🟢 Live'
      : socketStatus === 'connecting'
        ? '🟡 Connecting...'
        : '🔴 Offline';

  const socketStatusClass =
    socketStatus === 'connected'
      ? 'is-connected'
      : socketStatus === 'connecting'
        ? 'is-connecting'
        : 'is-disconnected';

  const detailsMessage =
    canvasNotice || titleError || 'Use V/S/R shortcuts for Select, Sticky, and Rect.';
  const gridCellSize = Math.max(8, Math.min(72, 24 * (zoomPercent / 100)));

  return (
    <main className="figma-board-root">
      <header className="figma-board-topbar">
        <div className="topbar-cluster left">
          <button className="icon-chip" aria-label="Menu">
            ≡
          </button>
          <div className="file-pill">
            <span className="logo-dot small" />
            <span>CollabBoard</span>
          </div>
          {editingTitle ? (
            <form
              className="board-title-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveTitle();
              }}
            >
              <input
                className="board-title-input"
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setEditingTitle(false);
                    setTitleDraft(boardTitle);
                  }
                }}
                autoFocus
              />
              <button className="primary-btn" type="submit" disabled={isSavingTitle}>
                {isSavingTitle ? 'Saving...' : 'Save'}
              </button>
              <button
                className="secondary-btn"
                type="button"
                onClick={() => {
                  setEditingTitle(false);
                  setTitleDraft(boardTitle);
                }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="board-title-display">
              <span className="doc-chip">{boardTitle}</span>
              <button
                className="chip-btn"
                onClick={() => {
                  setEditingTitle(true);
                  setTitleDraft(boardTitle);
                }}
              >
                Rename
              </button>
            </div>
          )}
        </div>

        <div className="topbar-cluster middle">
          <button className="chip-btn">Move</button>
          <button className="chip-btn">Frame</button>
          <button className="chip-btn">Text</button>
          <button className="chip-btn">Shape</button>
        </div>

        <div className="topbar-cluster right">
          <span className={`presence-pill ${socketStatusClass}`}>{socketStatusLabel}</span>
          <PresenceAvatars members={members} currentUserId={user?.uid ?? null} />
          {user ? (
            <>
              <button className="secondary-btn" onClick={() => navigate('/dashboard')}>
                Dashboard
              </button>
              <button className="primary-btn" onClick={() => void signOut().then(() => navigate('/'))}>
                Sign out
              </button>
            </>
          ) : (
            <button className="primary-btn" onClick={() => navigate('/')}>
              Sign in
            </button>
          )}
        </div>
      </header>

      <section className="figma-board-workspace">
        <aside className="figma-left-rail">
          <button
            className={`rail-btn ${activeTool === 'select' ? 'active' : ''}`}
            aria-label="Select tool"
            onClick={() => setActiveTool('select')}
          >
            ↖
          </button>
          <button
            className={`rail-btn ${activeTool === 'sticky' ? 'active' : ''}`}
            aria-label="Sticky note tool"
            onClick={() => setActiveTool('sticky')}
          >
            □
          </button>
          <button
            className={`rail-btn ${activeTool === 'rect' ? 'active' : ''}`}
            aria-label="Rectangle tool"
            onClick={() => setActiveTool('rect')}
          >
            ○
          </button>
          <button className="rail-btn" disabled aria-label="Text tool">
            T
          </button>
          <button className="rail-btn" disabled aria-label="Connector tool">
            ↔
          </button>
        </aside>

        <section className="figma-canvas-shell">
          <div className="canvas-top-info">
            <span>User: {displayName}</span>
            <span>{detailsMessage}</span>
          </div>
          <div
            className="canvas-grid cursor-canvas-grid"
            ref={canvasContainerRef}
            style={{ backgroundSize: `${gridCellSize}px ${gridCellSize}px` }}
          >
            <Stage
              ref={stageRef}
              width={canvasSize.width}
              height={canvasSize.height}
              className="cursor-stage"
              draggable={activeTool === 'select' && !editingText && !isDrawingRect && !isSelecting}
              onMouseDown={handleStageMouseDown}
              onTouchStart={handleStageMouseDown}
              onMouseMove={handleStageMouseMove}
              onTouchMove={handleStageMouseMove}
              onMouseUp={handleStageMouseUp}
              onTouchEnd={handleStageMouseUp}
              onMouseLeave={handleStageMouseLeave}
              onTouchCancel={handleStageMouseLeave}
              onClick={handleStageClick}
              onTap={handleStageClick}
              onWheel={handleStageWheel}
            >
              <Layer listening={false}>
                <KonvaRectShape
                  name="board-background"
                  x={-5000}
                  y={-5000}
                  width={10000}
                  height={10000}
                  fill="transparent"
                />
              </Layer>

              <Layer ref={objectsLayerRef} />

              <Layer ref={selectionLayerRef}>
                <Transformer ref={transformerRef} rotateEnabled />
                <KonvaRectShape
                  ref={selectionRectRef}
                  visible={false}
                  fill="rgba(37, 99, 235, 0.1)"
                  stroke="#2563eb"
                  strokeWidth={1}
                  dash={[4, 4]}
                />
              </Layer>

              <RemoteCursors cursors={remoteCursors} />
            </Stage>

            {editingText && textEditorLayout ? (
              <textarea
                className="sticky-text-editor"
                style={{
                  left: textEditorLayout.left,
                  top: textEditorLayout.top,
                  width: textEditorLayout.width,
                  height: textEditorLayout.height,
                  fontSize: textEditorLayout.fontSize,
                }}
                value={editingText.value}
                placeholder={STICKY_PLACEHOLDER_TEXT}
                autoFocus
                onChange={(event) => {
                  setEditingText((previous) =>
                    previous ? { ...previous, value: event.target.value } : previous,
                  );
                }}
                onBlur={() => {
                  commitTextEdit(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    commitTextEdit(false);
                    return;
                  }

                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    commitTextEdit(true);
                  }
                }}
              />
            ) : null}
          </div>

          <MetricsOverlay
            averageCursorLatencyMs={averageLatencyMs}
            averageObjectLatencyMs={averageObjectLatencyMs}
            userCount={members.length}
            objectCount={objectCount}
          />
        </section>

        <aside className="figma-right-panel">
          <h3>Properties</h3>
          {selectedIds.length === 0 ? (
            <>
              <div className="property-row">
                <span>Selection</span>
                <strong>None</strong>
              </div>
              <div className="property-row">
                <span>Zoom</span>
                <strong>{zoomPercent}%</strong>
              </div>
              <div className="property-row">
                <span>Grid</span>
                <strong>On</strong>
              </div>
            </>
          ) : selectedIds.length > 1 ? (
            <>
              <div className="property-row">
                <span>Selection</span>
                <strong>{selectedIds.length} objects</strong>
              </div>
              <button className="danger-btn property-delete-btn" onClick={() => removeObjects(selectedIds, true)}>
                Delete Selected
              </button>
            </>
          ) : selectedObject ? (
            <>
              <div className="property-row">
                <span>Selection</span>
                <strong>{selectedObject.type === 'sticky' ? 'Sticky Note' : 'Rectangle'}</strong>
              </div>
              <div className="property-row">
                <span>X</span>
                <strong>{Math.round(selectedObject.x)}</strong>
              </div>
              <div className="property-row">
                <span>Y</span>
                <strong>{Math.round(selectedObject.y)}</strong>
              </div>
              <div className="property-row">
                <span>W</span>
                <strong>{Math.round(selectedObject.width)}</strong>
              </div>
              <div className="property-row">
                <span>H</span>
                <strong>{Math.round(selectedObject.height)}</strong>
              </div>
              <div className="property-row">
                <span>Rotation</span>
                <strong>{Math.round(selectedObject.rotation)}°</strong>
              </div>
              <div className="property-row">
                <span>Color</span>
                <strong className="property-color-value">
                  <span className="property-color-dot" style={{ background: selectedObject.color }} />
                  {selectedObject.color}
                </strong>
              </div>
              <button
                className="danger-btn property-delete-btn"
                onClick={() => removeObjects([selectedObject.id], true)}
              >
                Delete
              </button>
            </>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
