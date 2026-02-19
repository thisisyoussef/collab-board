import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore/lite';
import Konva from 'konva';
import { useEffect, useRef, useState } from 'react';
import { Circle as KonvaCircleShape, Layer, Rect as KonvaRectShape, Stage, Transformer } from 'react-konva';
import { useNavigate, useParams } from 'react-router-dom';
import { AICommandCenter } from '../components/AICommandCenter';
import { MetricsOverlay } from '../components/MetricsOverlay';
import { PresenceAvatars } from '../components/PresenceAvatars';
import { ReconnectBanner } from '../components/ReconnectBanner';
import { RemoteCursors } from '../components/RemoteCursors';
import { useAuth } from '../hooks/useAuth';
import { useAICommandCenter } from '../hooks/useAICommandCenter';
import { useAIExecutor, type AICommitMeta } from '../hooks/useAIExecutor';
import { useCursors } from '../hooks/useCursors';
import { usePresence } from '../hooks/usePresence';
import { useSocket, type SocketStatus } from '../hooks/useSocket';
import {
  normalizeBoardRole,
  resolveBoardAccess,
  shouldRedirectToSignIn,
  type ResolveBoardAccessResult,
} from '../lib/access';
import {
  applyIncomingObjectUpsert,
  createDefaultObject,
  FRAME_DEFAULT_STROKE,
  FRAME_MIN_HEIGHT,
  FRAME_MIN_WIDTH,
  getObjectAnchorCandidates,
  getObjectBounds,
  normalizeLoadedObject as normalizeBoardObject,
  RECT_DEFAULT_STROKE,
  RECT_DEFAULT_STROKE_WIDTH,
  RECT_MIN_SIZE,
  resolveConnectorPoints,
  resolveObjectAnchorPoint,
  sanitizeBoardObjectForFirestore as sanitizeBoardObject,
  STICKY_DEFAULT_COLOR,
  STICKY_DEFAULT_HEIGHT,
  STICKY_DEFAULT_WIDTH,
  STICKY_MIN_HEIGHT,
  STICKY_MIN_WIDTH,
  TEXT_DEFAULT_COLOR,
  TEXT_DEFAULT_FONT_SIZE,
  TEXT_MIN_HEIGHT,
  TEXT_MIN_WIDTH,
} from '../lib/board-object';
import { toFirestoreUserMessage, withFirestoreTimeout } from '../lib/firestore-client';
import { db } from '../lib/firebase';
import { loadViewportState, saveViewportState } from '../lib/viewport';
import {
  buildRealtimeEventSignature,
  createRealtimeDedupeCache,
} from '../lib/realtime-dedupe';
import { screenToWorld, worldToScreen } from '../lib/utils';
import type { BoardObject, BoardObjectsRecord } from '../types/board';
import type { AIActionPreview } from '../types/ai';
import type {
  ObjectCreatePayload,
  ObjectDeletePayload,
  RealtimeObjectEventMeta,
  ObjectUpdatePayload,
} from '../types/realtime';

type ActiveTool = 'select' | 'sticky' | 'rect' | 'circle' | 'line' | 'text' | 'frame' | 'connector';

interface EditingTextState {
  id: string;
  value: string;
}

interface ShapeDraftState {
  id: string;
  startX: number;
  startY: number;
  type: 'rect' | 'circle' | 'line';
}

interface ConnectorDraftState {
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

type BoardCanvasNode = Konva.Group | Konva.Shape;
type ConnectorEndpoint = 'from' | 'to';

interface ConnectorAttachmentResult {
  objectId: string;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
}

interface ConnectorAttachmentCandidate extends ConnectorAttachmentResult {
  distance: number;
}

interface ConnectorShapeAnchorMarker {
  key: string;
  objectId: string;
  anchorX: number;
  anchorY: number;
  x: number;
  y: number;
  endpoint: ConnectorEndpoint | null;
}

interface ConnectorAnchorIgnore {
  objectId: string;
  anchorX: number;
  anchorY: number;
}

interface BoardDocData {
  ownerId?: string;
  createdBy?: string;
  title?: string;
  objects?: BoardObjectsRecord;
  sharing?: {
    visibility?: string;
    authLinkRole?: string;
    publicLinkRole?: string;
  };
}

const STICKY_PLACEHOLDER_TEXT = 'New note';
const RECT_CLICK_DEFAULT_WIDTH = 180;
const RECT_CLICK_DEFAULT_HEIGHT = 120;
const CIRCLE_CLICK_DEFAULT_SIZE = 120;
const LINE_CLICK_DEFAULT_WIDTH = 180;
const RECT_CLICK_DRAG_THRESHOLD = 8;
const BOARD_SAVE_DEBOUNCE_MS = 300;
const OBJECT_UPDATE_EMIT_THROTTLE_MS = 45;
const OBJECT_LATENCY_SAMPLE_WINDOW = 30;
const OBJECT_LATENCY_UI_UPDATE_MS = 120;
const AI_APPLY_LATENCY_SAMPLE_WINDOW = 20;
const SHARE_FEEDBACK_RESET_MS = 2000;
const VIEWPORT_SAVE_DEBOUNCE_MS = 180;
const REALTIME_DEDUPE_TTL_MS = 30_000;
const REALTIME_DEDUPE_MAX_ENTRIES = 4_000;
const CONNECTOR_HANDLE_RADIUS = 7;
const CONNECTOR_HANDLE_STROKE = '#2563eb';
const CONNECTOR_SNAP_DISTANCE_PX = 20;
const CONNECTOR_SNAP_RELEASE_BUFFER_PX = 10;
const SHAPE_ANCHOR_RADIUS = 4;
const SHAPE_ANCHOR_MATCH_EPSILON = 0.01;

type PendingRemoteObjectEvent =
  | { kind: 'create'; payload: ObjectCreatePayload }
  | { kind: 'update'; payload: ObjectUpdatePayload }
  | { kind: 'delete'; payload: ObjectDeletePayload };

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

function fallbackCopyToClipboard(value: string): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, value.length);

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  textarea.remove();
  return copied;
}

function normalizeLoadedObject(raw: unknown, fallbackUserId: string): BoardObject | null {
  return normalizeBoardObject(raw, fallbackUserId);
}

function sanitizeBoardObjectForFirestore(entry: BoardObject): BoardObject {
  return sanitizeBoardObject(entry);
}

function buildBoardReturnToPath(boardId: string): string {
  if (typeof window !== 'undefined') {
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentPath.startsWith('/board/')) {
      return currentPath;
    }
  }
  return `/board/${boardId}`;
}

export function Board() {
  const { id: boardId } = useParams<{ id: string }>();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [boardAccess, setBoardAccess] = useState<ResolveBoardAccessResult | null>(null);
  const [boardMissing, setBoardMissing] = useState(false);
  const [isResolvingAccess, setIsResolvingAccess] = useState(Boolean(boardId));
  const canReadBoard = Boolean(boardAccess?.canRead);
  const canEditBoard = Boolean(boardAccess?.canEdit);
  const canApplyAI = Boolean(boardAccess?.canApplyAI);
  const activeBoardId = canReadBoard ? boardId : undefined;
  const {
    socketRef,
    status: socketStatus,
    reconnectCount,
    connectedSinceMs,
    disconnectedSinceMs,
  } = useSocket(activeBoardId);
  const { members } = usePresence({ boardId: activeBoardId, user, socketRef, socketStatus });
  const { remoteCursors, averageLatencyMs, publishCursor, publishCursorHide } = useCursors({
    boardId: activeBoardId,
    user,
    socketRef,
    socketStatus,
  });

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
  const rectDraftRef = useRef<ShapeDraftState | null>(null);
  const connectorDraftRef = useRef<ConnectorDraftState | null>(null);
  const selectionDraftRef = useRef<SelectionDraftState | null>(null);
  const boardIdRef = useRef<string | undefined>(boardId);
  const previousSocketStatusRef = useRef<SocketStatus>(socketStatus);
  const realtimeObjectEmitAtRef = useRef<Record<string, number>>({});
  const hasInitialBoardLoadRef = useRef(false);
  const pendingRemoteObjectEventsRef = useRef<PendingRemoteObjectEvent[]>([]);
  const objectLatencySamplesRef = useRef<number[]>([]);
  const lastObjectLatencyUiUpdateAtRef = useRef(0);
  const aiApplyLatencySamplesRef = useRef<number[]>([]);
  const realtimeDedupeRef = useRef(
    createRealtimeDedupeCache({
      ttlMs: REALTIME_DEDUPE_TTL_MS,
      maxEntries: REALTIME_DEDUPE_MAX_ENTRIES,
    }),
  );
  const shareFeedbackTimeoutRef = useRef<number | null>(null);
  const viewportSaveTimeoutRef = useRef<number | null>(null);
  const viewportRestoredRef = useRef(false);

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
  const [isDrawingConnector, setIsDrawingConnector] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isDraggingConnectorHandle, setIsDraggingConnectorHandle] = useState(false);
  const [averageObjectLatencyMs, setAverageObjectLatencyMs] = useState(0);
  const [averageAIApplyLatencyMs, setAverageAIApplyLatencyMs] = useState(0);
  const [aiApplyCount, setAiApplyCount] = useState(0);
  const [aiDedupeDrops, setAiDedupeDrops] = useState(0);
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'error'>('idle');

  const selectedObject =
    selectedIds.length === 1 ? objectsRef.current.get(selectedIds[0]) ?? null : null;
  const selectedConnector =
    selectedObject && selectedObject.type === 'connector' ? selectedObject : null;
  const selectedShapeQuickConnectId =
    activeTool === 'select' &&
    selectedIds.length === 1 &&
    selectedObject &&
    selectedObject.type !== 'connector'
      ? selectedObject.id
      : null;
  const canStartConnectorFromAnchor =
    canEditBoard && (activeTool === 'connector' || Boolean(selectedShapeQuickConnectId));
  const connectorShapeAnchors = (() => {
    const showConnectorToolAnchors = activeTool === 'connector';
    const showSelectedConnectorAnchors = activeTool === 'select' && Boolean(selectedConnector);
    const showQuickConnectAnchors = Boolean(selectedShapeQuickConnectId);
    if (!showConnectorToolAnchors && !showSelectedConnectorAnchors && !showQuickConnectAnchors) {
      return [] as ConnectorShapeAnchorMarker[];
    }

    const markers: ConnectorShapeAnchorMarker[] = [];
    objectsRef.current.forEach((entry) => {
      if (entry.type === 'connector') {
        return;
      }
      if (
        showQuickConnectAnchors &&
        !showConnectorToolAnchors &&
        !showSelectedConnectorAnchors &&
        entry.id !== selectedShapeQuickConnectId
      ) {
        return;
      }

      const candidates = getObjectAnchorCandidates(entry);
      candidates.forEach((candidate, index) => {
        const connector = showSelectedConnectorAnchors ? selectedConnector : null;
        const fromMatch =
          connector?.fromId === entry.id &&
          Number.isFinite(connector.fromAnchorX) &&
          Number.isFinite(connector.fromAnchorY) &&
          Math.abs((connector.fromAnchorX || 0) - candidate.anchorX) <=
            SHAPE_ANCHOR_MATCH_EPSILON &&
          Math.abs((connector.fromAnchorY || 0) - candidate.anchorY) <=
            SHAPE_ANCHOR_MATCH_EPSILON;
        const toMatch =
          connector?.toId === entry.id &&
          Number.isFinite(connector.toAnchorX) &&
          Number.isFinite(connector.toAnchorY) &&
          Math.abs((connector.toAnchorX || 0) - candidate.anchorX) <=
            SHAPE_ANCHOR_MATCH_EPSILON &&
          Math.abs((connector.toAnchorY || 0) - candidate.anchorY) <=
            SHAPE_ANCHOR_MATCH_EPSILON;

        markers.push({
          key: `${entry.id}-${index}`,
          objectId: entry.id,
          anchorX: candidate.anchorX,
          anchorY: candidate.anchorY,
          x: candidate.x,
          y: candidate.y,
          endpoint: fromMatch ? 'from' : toMatch ? 'to' : null,
        });
      });
    });

    return markers;
  })();
  const aiCommandCenter = useAICommandCenter({
    boardId,
    user,
    getBoardState: serializeBoardObjects,
  });
  const aiExecutor = useAIExecutor({
    actorUserId: user?.uid || 'guest',
    getBoardState: serializeBoardObjects,
    commitBoardState: applyAIBoardStateCommit,
  });

  const handleApplyAIPlan = async (actions: AIActionPreview[] = aiCommandCenter.actions) => {
    if (!canApplyAI) {
      setCanvasNotice('AI apply requires signed-in editor access.');
      return;
    }
    const startedAt = performance.now();
    const applied = await aiExecutor.applyPreviewActions(actions, aiCommandCenter.message);
    if (applied) {
      recordAIApplyLatency(performance.now() - startedAt);
      setCanvasNotice('AI changes applied.');
    }
  };

  const handleSubmitAI = async () => {
    if (!canApplyAI) {
      setCanvasNotice('AI planning is available only to signed-in editors.');
      return;
    }
    const result = await aiCommandCenter.submitPrompt();
    if (!result || aiCommandCenter.mode !== 'auto' || result.actions.length === 0) {
      return;
    }
    await handleApplyAIPlan(result.actions);
  };

  const handleRetryAI = async () => {
    if (!canApplyAI) {
      setCanvasNotice('AI planning is available only to signed-in editors.');
      return;
    }
    const result = await aiCommandCenter.retryLast();
    if (!result || aiCommandCenter.mode !== 'auto' || result.actions.length === 0) {
      return;
    }
    await handleApplyAIPlan(result.actions);
  };

  const handleUndoAI = async () => {
    if (!canApplyAI) {
      setCanvasNotice('AI undo requires signed-in editor access.');
      return;
    }
    const undone = await aiExecutor.undoLast();
    if (undone) {
      setCanvasNotice('Undid last AI apply.');
    }
  };

  const textEditorLayout = (() => {
    if (!editingText) {
      return null;
    }

    const stage = stageRef.current;
    const object = objectsRef.current.get(editingText.id);
    if (!stage || !object || (object.type !== 'sticky' && object.type !== 'text')) {
      return null;
    }

    const point = worldToScreen(stage, { x: object.x, y: object.y });
    const scale = stage.scaleX() || 1;
    const minWidth = object.type === 'sticky' ? STICKY_MIN_WIDTH : TEXT_MIN_WIDTH;
    const minHeight = object.type === 'sticky' ? STICKY_MIN_HEIGHT : TEXT_MIN_HEIGHT;
    const fontSize = object.fontSize || (object.type === 'sticky' ? 14 : TEXT_DEFAULT_FONT_SIZE);

    return {
      left: point.x,
      top: point.y,
      width: Math.max(minWidth, object.width * scale),
      height: Math.max(minHeight, object.height * scale),
      fontSize: Math.max(12, fontSize * scale),
    };
  })();

  useEffect(() => {
    boardIdRef.current = boardId;
    hasInitialBoardLoadRef.current = false;
    pendingRemoteObjectEventsRef.current = [];
    objectLatencySamplesRef.current = [];
    lastObjectLatencyUiUpdateAtRef.current = 0;
    aiApplyLatencySamplesRef.current = [];
    realtimeDedupeRef.current.clear();
    setAverageObjectLatencyMs(0);
    setAverageAIApplyLatencyMs(0);
    setAiApplyCount(0);
    setAiDedupeDrops(0);
    if (shareFeedbackTimeoutRef.current) {
      window.clearTimeout(shareFeedbackTimeoutRef.current);
      shareFeedbackTimeoutRef.current = null;
    }
    if (viewportSaveTimeoutRef.current) {
      window.clearTimeout(viewportSaveTimeoutRef.current);
      viewportSaveTimeoutRef.current = null;
    }
    viewportRestoredRef.current = false;
    setBoardTitle('Untitled board');
    setTitleDraft('Untitled board');
    setEditingTitle(false);
    setIsSavingTitle(false);
    setTitleError(null);
    setShareState('idle');
    setBoardAccess(null);
    setBoardMissing(false);
    setIsResolvingAccess(Boolean(boardId));
  }, [boardId]);

  useEffect(
    () => () => {
      if (shareFeedbackTimeoutRef.current) {
        window.clearTimeout(shareFeedbackTimeoutRef.current);
        shareFeedbackTimeoutRef.current = null;
      }
      if (viewportSaveTimeoutRef.current) {
        window.clearTimeout(viewportSaveTimeoutRef.current);
        viewportSaveTimeoutRef.current = null;
      }
      clearPersistenceTimer();
      flushBoardSave();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!boardId) {
      setBoardAccess(null);
      setBoardMissing(false);
      setIsResolvingAccess(false);
      return;
    }

    let cancelled = false;
    setIsResolvingAccess(true);

    const resolveAccess = async () => {
      try {
        const boardSnapshot = await withFirestoreTimeout(
          'Loading board access',
          getDoc(doc(db, 'boards', boardId)),
        );
        if (cancelled) {
          return;
        }

        if (!boardSnapshot.exists()) {
          setBoardAccess(null);
          setBoardMissing(true);
          setCanvasNotice('Board not found.');
          setIsResolvingAccess(false);
          return;
        }

        const boardData = boardSnapshot.data() as BoardDocData;
        setBoardMissing(false);
        const ownerId = boardData.ownerId || boardData.createdBy || null;
        const currentUserId = user?.uid || null;
        let explicitMemberRole: 'owner' | 'editor' | 'viewer' | null = null;

        if (currentUserId && ownerId !== currentUserId) {
          try {
            const memberSnapshot = await withFirestoreTimeout(
              'Loading board membership',
              getDoc(doc(db, 'boardMembers', `${boardId}_${currentUserId}`)),
            );
            if (!cancelled && memberSnapshot.exists()) {
              const roleValue = (memberSnapshot.data() as { role?: unknown }).role;
              const normalizedRole = normalizeBoardRole(roleValue);
              explicitMemberRole = normalizedRole === 'none' ? null : normalizedRole;
            }
          } catch {
            // Membership lookups are best-effort; access still resolves from board sharing.
          }
        }

        if (cancelled) {
          return;
        }

        const access = resolveBoardAccess({
          ownerId,
          userId: currentUserId,
          isAuthenticated: Boolean(user),
          explicitMemberRole,
          sharing: boardData.sharing ?? null,
        });

        setBoardAccess(access);
        if (!access.canRead && shouldRedirectToSignIn(access, Boolean(user))) {
          navigate(`/?returnTo=${encodeURIComponent(buildBoardReturnToPath(boardId))}`, {
            replace: true,
          });
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        const errorCode =
          err && typeof err === 'object' && 'code' in err && typeof err.code === 'string'
            ? err.code
            : '';
        const permissionDenied = errorCode === 'permission-denied';

        if (!user && permissionDenied) {
          navigate(`/?returnTo=${encodeURIComponent(buildBoardReturnToPath(boardId))}`, {
            replace: true,
          });
          return;
        }

        if (permissionDenied) {
          setBoardMissing(false);
          setBoardAccess(
            resolveBoardAccess({
              ownerId: null,
              userId: user?.uid ?? null,
              isAuthenticated: Boolean(user),
              sharing: { visibility: 'private' },
            }),
          );
          setCanvasNotice('You do not have access to this board.');
        } else {
          setBoardMissing(false);
          setCanvasNotice(toFirestoreUserMessage('Unable to load board access.', err));
        }
      } finally {
        if (!cancelled) {
          setIsResolvingAccess(false);
        }
      }
    };

    void resolveAccess();
    return () => {
      cancelled = true;
    };
  }, [boardId, navigate, user]);

  useEffect(() => {
    if (!boardId || !canReadBoard) {
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
  }, [boardId, canReadBoard]);

  useEffect(() => {
    if (!boardId || !canReadBoard) {
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

        const rawObjects = (snapshot.data() as { objects?: BoardObjectsRecord }).objects || {};
        hydrateBoardObjects(rawObjects, user?.uid || 'guest');
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
  }, [boardId, canReadBoard, user]);

  useEffect(() => {
    if (!boardId || isResolvingAccess || canReadBoard) {
      return;
    }

    clearBoardObjects();
  }, [boardId, canReadBoard, isResolvingAccess]);

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
    if (!boardId || viewportRestoredRef.current) {
      return;
    }

    const stage = stageRef.current;
    if (!stage || canvasSize.width <= 0 || canvasSize.height <= 0) {
      return;
    }

    const restored = loadViewportState({
      boardId,
      userId: user?.uid ?? null,
    });

    if (restored) {
      stage.scale({ x: restored.scale, y: restored.scale });
      stage.position({ x: restored.x, y: restored.y });
      stage.batchDraw();
      setZoomPercent(Math.round(restored.scale * 100));
    } else {
      setZoomPercent(Math.round((stage.scaleX() || 1) * 100));
    }

    viewportRestoredRef.current = true;
  }, [boardId, canvasSize.height, canvasSize.width, user?.uid]);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) {
      return;
    }

    if (!canEditBoard) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    const nodes = selectedIds
      .filter((id) => objectsRef.current.get(id)?.type !== 'connector')
      .map((id) => stage.findOne(`#${id}`))
      .filter((node): node is Konva.Node => Boolean(node));

    const singleSelected =
      selectedIds.length === 1 ? objectsRef.current.get(selectedIds[0]) ?? null : null;
    const isCircleSelection = singleSelected?.type === 'circle';
    transformer.keepRatio(Boolean(isCircleSelection));
    transformer.enabledAnchors(
      isCircleSelection
        ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
        : [
            'top-left',
            'top-center',
            'top-right',
            'middle-left',
            'middle-right',
            'bottom-left',
            'bottom-center',
            'bottom-right',
          ],
    );

    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, boardRevision, canEditBoard]);

  useEffect(() => {
    if (!selectedConnector) {
      setIsDraggingConnectorHandle(false);
    }
  }, [selectedConnector]);

  useEffect(() => {
    if (canEditBoard) {
      return;
    }

    setActiveTool('select');
    setEditingText(null);
    setEditingTitle(false);
  }, [canEditBoard]);

  useEffect(() => {
    objectsRef.current.forEach((_, id) => {
      const node = stageRef.current?.findOne(`#${id}`);
      if (!node) {
        return;
      }

      const object = objectsRef.current.get(id);
      const isConnector = object?.type === 'connector';
      node.draggable(
        canEditBoard &&
          activeTool === 'select' &&
          !editingText &&
          !isConnector &&
          !isDraggingConnectorHandle,
      );
    });
  }, [activeTool, editingText, isDraggingConnectorHandle, boardRevision, canEditBoard]);

  useEffect(() => {
    if (!boardId) {
      return;
    }

    const handlePageHide = () => {
      saveViewportNow();
      flushBoardSave();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveViewportNow();
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

      const objectId = typeof payload?.object?.id === 'string' ? payload.object.id.trim() : '';
      if (!objectId || !shouldApplyRemoteObjectEvent('object:create', payload, objectId)) {
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

      const objectId = typeof payload?.object?.id === 'string' ? payload.object.id.trim() : '';
      if (!objectId || !shouldApplyRemoteObjectEvent('object:update', payload, objectId)) {
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

      const objectId = typeof payload?.objectId === 'string' ? payload.objectId.trim() : '';
      if (!objectId || !shouldApplyRemoteObjectEvent('object:delete', payload, objectId)) {
        return;
      }

      if (!hasInitialBoardLoadRef.current) {
        enqueueRemoteObjectEvent({ kind: 'delete', payload });
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
          hydrateBoardObjects(rawObjects, user?.uid || 'guest');
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

  useEffect(() => {
    const previousStatus = previousSocketStatusRef.current;
    previousSocketStatusRef.current = socketStatus;

    if (!boardId) {
      return;
    }

    if (previousStatus !== 'disconnected' || socketStatus !== 'connected') {
      return;
    }

    if (!hasInitialBoardLoadRef.current) {
      return;
    }

    let cancelled = false;

    const resyncFromFirestore = async () => {
      try {
        const snapshot = await withFirestoreTimeout(
          'Resyncing board after reconnect',
          getDoc(doc(db, 'boards', boardId)),
        );

        if (cancelled || !snapshot.exists()) {
          return;
        }

        const rawObjects = (snapshot.data() as { objects?: BoardObjectsRecord }).objects || {};
        hydrateBoardObjects(rawObjects, user?.uid || 'guest');
      } catch (err) {
        if (cancelled) {
          return;
        }
        setCanvasNotice(toFirestoreUserMessage('Unable to resync board after reconnect.', err));
      }
    };

    void resyncFromFirestore();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, socketStatus, user]);

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

  function saveViewportNow() {
    const stage = stageRef.current;
    const liveBoardId = boardIdRef.current;
    if (!stage || !liveBoardId) {
      return;
    }

    saveViewportState({
      boardId: liveBoardId,
      userId: user?.uid ?? null,
      viewport: {
        x: stage.x(),
        y: stage.y(),
        scale: stage.scaleX() || 1,
      },
    });
  }

  function scheduleViewportSave() {
    if (viewportSaveTimeoutRef.current) {
      window.clearTimeout(viewportSaveTimeoutRef.current);
    }

    viewportSaveTimeoutRef.current = window.setTimeout(() => {
      saveViewportNow();
      viewportSaveTimeoutRef.current = null;
    }, VIEWPORT_SAVE_DEBOUNCE_MS);
  }

  function clearPersistenceTimer() {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }

  function recordAIApplyLatency(durationMs: number) {
    if (!Number.isFinite(durationMs)) {
      return;
    }

    const next = [...aiApplyLatencySamplesRef.current, Math.max(0, Math.round(durationMs))].slice(
      -AI_APPLY_LATENCY_SAMPLE_WINDOW,
    );
    aiApplyLatencySamplesRef.current = next;
    const average = next.reduce((sum, value) => sum + value, 0) / next.length;
    setAverageAIApplyLatencyMs(Math.round(average));
    setAiApplyCount((value) => value + 1);
  }

  function trackAIDedupeDrop() {
    setAiDedupeDrops((value) => value + 1);
  }

  function shouldApplyRemoteObjectEvent(
    eventType: 'object:create' | 'object:update' | 'object:delete',
    payload: ObjectCreatePayload | ObjectUpdatePayload | ObjectDeletePayload,
    objectId: string,
  ): boolean {
    const signature = buildRealtimeEventSignature({
      eventType,
      boardId: payload.boardId,
      objectId,
      txId: payload.txId,
      source: payload.source,
      actorUserId: payload.actorUserId,
      ts: payload._ts,
    });

    if (!signature) {
      return true;
    }

    const shouldApply = realtimeDedupeRef.current.markIfNew(signature);
    if (!shouldApply && (payload.source === 'ai' || Boolean(payload.txId))) {
      trackAIDedupeDrop();
    }
    return shouldApply;
  }

  function buildRealtimeObjectMeta(meta?: RealtimeObjectEventMeta): RealtimeObjectEventMeta {
    return {
      source: meta?.source === 'ai' ? 'ai' : 'user',
      ...(meta?.txId ? { txId: meta.txId } : {}),
      actorUserId: meta?.actorUserId || user?.uid || 'guest',
    };
  }

  function emitObjectCreate(object: BoardObject, meta?: RealtimeObjectEventMeta) {
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
      ...buildRealtimeObjectMeta(meta),
    });
  }

  function emitObjectUpdate(object: BoardObject, force = false, meta?: RealtimeObjectEventMeta) {
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
      ...buildRealtimeObjectMeta(meta),
    };

    socket.emit('object:update', payload);
  }

  function emitObjectDelete(objectId: string, meta?: RealtimeObjectEventMeta) {
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
      ...buildRealtimeObjectMeta(meta),
    });
  }

  function serializeBoardObjects(): BoardObjectsRecord {
    const objectsRecord: BoardObjectsRecord = {};
    objectsRef.current.forEach((entry, id) => {
      objectsRecord[id] = sanitizeBoardObjectForFirestore(entry);
    });
    return objectsRecord;
  }

  function applyAIBoardStateCommit(nextBoardState: BoardObjectsRecord, meta: AICommitMeta) {
    hydrateBoardObjects(nextBoardState, user?.uid || 'guest');
    setSelectedIds([]);
    const realtimeMeta: RealtimeObjectEventMeta = {
      txId: meta.txId,
      source: 'ai',
      actorUserId: user?.uid || 'guest',
    };

    meta.diff.createdIds.forEach((objectId) => {
      const object = objectsRef.current.get(objectId);
      if (object) {
        emitObjectCreate(object, realtimeMeta);
      }
    });
    meta.diff.updatedIds.forEach((objectId) => {
      const object = objectsRef.current.get(objectId);
      if (object) {
        emitObjectUpdate(object, true, realtimeMeta);
      }
    });
    meta.diff.deletedIds.forEach((objectId) => {
      emitObjectDelete(objectId, realtimeMeta);
    });

    scheduleBoardSave();
    // AI and undo are high-intent actions; flush immediately to reduce refresh race windows.
    flushBoardSave();
  }

  async function persistBoardSave() {
    const liveBoardId = boardIdRef.current;
    if (!liveBoardId || !hasUnsavedChangesRef.current || !canEditBoard) {
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
          source: 'user',
          actorUserId: user?.uid || 'guest',
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
    if (!canEditBoard) {
      hasUnsavedChangesRef.current = false;
      clearPersistenceTimer();
      return;
    }
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
    connectorDraftRef.current = null;
    hasUnsavedChangesRef.current = false;
    setObjectCount(0);
    setSelectedIds([]);
    setEditingText(null);
    setIsDrawingConnector(false);
  }

  function syncObjectsLayerZOrder() {
    const layer = objectsLayerRef.current;
    const stage = stageRef.current;
    if (!layer || !stage) {
      return;
    }

    const orderedObjects = Array.from(objectsRef.current.values()).sort((a, b) => {
      if (a.zIndex === b.zIndex) {
        return a.id.localeCompare(b.id);
      }
      return a.zIndex - b.zIndex;
    });

    orderedObjects.forEach((entry, index) => {
      const node = stage.findOne(`#${entry.id}`);
      if (!node) {
        return;
      }
      node.zIndex(index);
    });
  }

  function hydrateBoardObjects(rawObjects: BoardObjectsRecord, fallbackUserId: string) {
    clearBoardObjects();

    const normalizedObjects = Object.values(rawObjects)
      .map((entry) => normalizeLoadedObject(entry, fallbackUserId))
      .filter((entry): entry is BoardObject => Boolean(entry))
      .sort((a, b) => a.zIndex - b.zIndex);

    normalizedObjects.forEach((entry) => {
      objectsRef.current.set(entry.id, entry);
      const node = createNodeForObject(entry);
      objectsLayerRef.current?.add(node);
    });
    syncObjectsLayerZOrder();

    normalizedObjects.forEach((entry) => {
      if (entry.type !== 'connector') {
        syncConnectedConnectors(entry.id, false, false);
      }
    });

    objectsLayerRef.current?.batchDraw();
    setObjectCount(objectsRef.current.size);
    hasUnsavedChangesRef.current = false;
    setCanvasNotice(null);
    setBoardRevision((value) => value + 1);
    hasInitialBoardLoadRef.current = true;
    flushPendingRemoteObjectEvents();
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
    let normalized = sanitizeBoardObjectForFirestore(entry);
    const existing = objectsRef.current.get(normalized.id);
    const applyDecision = applyIncomingObjectUpsert({
      existing,
      incoming: normalized,
      eventTs,
    });
    if (!applyDecision.shouldApply) {
      return false;
    }

    if (normalized.type === 'connector') {
      const from = normalized.fromId ? objectsRef.current.get(normalized.fromId) : undefined;
      const to = normalized.toId ? objectsRef.current.get(normalized.toId) : undefined;
      const points = resolveConnectorPoints({
        from,
        to,
        fromAnchorX: normalized.fromAnchorX,
        fromAnchorY: normalized.fromAnchorY,
        toAnchorX: normalized.toAnchorX,
        toAnchorY: normalized.toAnchorY,
        fallback: normalized.points || [normalized.x, normalized.y, normalized.x + normalized.width, normalized.y],
      });
      normalized = {
        ...normalized,
        x: 0,
        y: 0,
        points,
        width: Math.abs((points[2] || 0) - (points[0] || 0)),
        height: Math.abs((points[3] || 0) - (points[1] || 0)),
      };
    }

    const existingNode = stageRef.current?.findOne(`#${normalized.id}`);

    const isNodeCompatible =
      !!existingNode &&
      ((normalized.type === 'sticky' && existingNode instanceof Konva.Group) ||
        ((normalized.type === 'rect' || normalized.type === 'circle') &&
          existingNode instanceof Konva.Rect) ||
        (normalized.type === 'line' &&
          existingNode instanceof Konva.Line &&
          !(existingNode instanceof Konva.Arrow)) ||
        (normalized.type === 'text' && existingNode instanceof Konva.Text) ||
        (normalized.type === 'frame' && existingNode instanceof Konva.Group) ||
        (normalized.type === 'connector' &&
          ((normalized.style === 'arrow' && existingNode instanceof Konva.Arrow) ||
            (normalized.style !== 'arrow' &&
              existingNode instanceof Konva.Line &&
              !(existingNode instanceof Konva.Arrow)))));

    const node = isNodeCompatible ? (existingNode as BoardCanvasNode) : null;
    if (existingNode && !isNodeCompatible) {
      existingNode.destroy();
    }

    const targetNode = node || createNodeForObject(normalized);
    if (!node) {
      objectsLayerRef.current?.add(targetNode);
    }

    if (normalized.type === 'sticky' && targetNode instanceof Konva.Group) {
      targetNode.setAttrs({
        x: normalized.x,
        y: normalized.y,
        rotation: normalized.rotation,
      });

      const body = targetNode.findOne('.sticky-body') as Konva.Rect | null;
      const label = targetNode.findOne('.sticky-label') as Konva.Text | null;
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

    if ((normalized.type === 'rect' || normalized.type === 'circle') && targetNode instanceof Konva.Rect) {
      targetNode.setAttrs({
        x: normalized.x,
        y: normalized.y,
        width: normalized.width,
        height: normalized.height,
        rotation: normalized.rotation,
        fill: normalized.color,
        stroke: normalized.stroke || RECT_DEFAULT_STROKE,
        strokeWidth: normalized.strokeWidth || RECT_DEFAULT_STROKE_WIDTH,
        cornerRadius:
          normalized.type === 'circle' ? Math.min(normalized.width, normalized.height) / 2 : 0,
      });
    }

    if (normalized.type === 'line' && targetNode instanceof Konva.Line) {
      targetNode.setAttrs({
        x: normalized.x,
        y: normalized.y,
        points: normalized.points || [0, 0, normalized.width, normalized.height],
        stroke: normalized.color,
        strokeWidth: normalized.strokeWidth || 2,
        rotation: normalized.rotation,
      });
    }

    if (normalized.type === 'text' && targetNode instanceof Konva.Text) {
      targetNode.setAttrs({
        x: normalized.x,
        y: normalized.y,
        width: normalized.width,
        height: normalized.height,
        text: normalized.text || 'Text',
        fill: normalized.color || TEXT_DEFAULT_COLOR,
        fontSize: normalized.fontSize || TEXT_DEFAULT_FONT_SIZE,
        rotation: normalized.rotation,
      });
    }

    if (normalized.type === 'frame' && targetNode instanceof Konva.Group) {
      targetNode.setAttrs({
        x: normalized.x,
        y: normalized.y,
        rotation: normalized.rotation,
      });
      const body = targetNode.findOne('.frame-body') as Konva.Rect | null;
      const title = targetNode.findOne('.frame-title') as Konva.Text | null;
      body?.setAttrs({
        width: normalized.width,
        height: normalized.height,
        fill: normalized.color || '#fff',
        stroke: normalized.stroke || FRAME_DEFAULT_STROKE,
        strokeWidth: normalized.strokeWidth || 2,
      });
      title?.setAttrs({
        width: Math.max(60, normalized.width - 20),
        text: normalized.title || 'Frame',
      });
    }

    if (normalized.type === 'connector' && (targetNode instanceof Konva.Line || targetNode instanceof Konva.Arrow)) {
      targetNode.setAttrs({
        points: normalized.points || [normalized.x, normalized.y, normalized.x + normalized.width, normalized.y],
        stroke: normalized.color,
        strokeWidth: normalized.strokeWidth || 2,
      });
      if (targetNode instanceof Konva.Line) {
        if (normalized.style === 'dashed') {
          targetNode.dash([10, 6]);
        } else {
          targetNode.dash([]);
        }
      }
    }

    objectsRef.current.set(normalized.id, normalized);
    syncObjectsLayerZOrder();
    objectsLayerRef.current?.batchDraw();
    if (!existing) {
      setObjectCount(objectsRef.current.size);
    }

    if (normalized.type !== 'connector') {
      syncConnectedConnectors(normalized.id, false, false);
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
    syncObjectsLayerZOrder();
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

  function applyCircleTransform(node: Konva.Rect, object: BoardObject) {
    const scaleX = node.scaleX() || 1;
    const scaleY = node.scaleY() || 1;
    const scaledWidth = Math.max(RECT_MIN_SIZE, node.width() * scaleX || object.width * scaleX);
    const scaledHeight = Math.max(RECT_MIN_SIZE, node.height() * scaleY || object.height * scaleY);
    const size = Math.max(RECT_MIN_SIZE, Math.max(scaledWidth, scaledHeight));
    const centerX = node.x() + scaledWidth / 2;
    const centerY = node.y() + scaledHeight / 2;

    node.position({
      x: centerX - size / 2,
      y: centerY - size / 2,
    });
    node.width(size);
    node.height(size);
    node.cornerRadius(size / 2);
    node.scale({ x: 1, y: 1 });
  }

  function applyLineTransform(node: Konva.Line | Konva.Arrow) {
    const scaleX = node.scaleX() || 1;
    const scaleY = node.scaleY() || 1;
    const scaledPoints = node
      .points()
      .map((value, index) => (index % 2 === 0 ? value * scaleX : value * scaleY));
    node.points(scaledPoints);
    node.scale({ x: 1, y: 1 });
  }

  function applyTextTransform(node: Konva.Text, object: BoardObject) {
    const scaleX = node.scaleX() || 1;
    const scaleY = node.scaleY() || 1;
    const width = Math.max(TEXT_MIN_WIDTH, node.width() * scaleX || object.width * scaleX);
    const height = Math.max(TEXT_MIN_HEIGHT, node.height() * scaleY || object.height * scaleY);
    const nextFontSize = Math.max(
      10,
      (object.fontSize || TEXT_DEFAULT_FONT_SIZE) * Math.min(scaleX, scaleY),
    );

    node.width(width);
    node.height(height);
    node.fontSize(nextFontSize);
    node.scale({ x: 1, y: 1 });
  }

  function applyFrameTransform(node: Konva.Group, object: BoardObject) {
    const scaleX = node.scaleX() || 1;
    const scaleY = node.scaleY() || 1;
    const width = Math.max(FRAME_MIN_WIDTH, object.width * scaleX);
    const height = Math.max(FRAME_MIN_HEIGHT, object.height * scaleY);
    const body = node.findOne('.frame-body') as Konva.Rect | null;
    const title = node.findOne('.frame-title') as Konva.Text | null;

    body?.setAttrs({ width, height });
    title?.setAttrs({ width: Math.max(60, width - 20) });
    node.scale({ x: 1, y: 1 });
  }

  function getConnectorPoints(connector: BoardObject): [number, number, number, number] {
    const points = connector.points || [connector.x, connector.y, connector.x + connector.width, connector.y];
    return [points[0] || 0, points[1] || 0, points[2] || 0, points[3] || 0];
  }

  function findClosestAnchorForObject(
    entry: BoardObject,
    point: { x: number; y: number },
  ): ConnectorAttachmentCandidate | null {
    const candidates = getObjectAnchorCandidates(entry);
    if (candidates.length === 0) {
      return null;
    }

    let best: ConnectorAttachmentCandidate | null = null;
    candidates.forEach((candidate) => {
      const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
      if (!best || distance < best.distance) {
        best = {
          objectId: entry.id,
          x: candidate.x,
          y: candidate.y,
          anchorX: candidate.anchorX,
          anchorY: candidate.anchorY,
          distance,
        };
      }
    });

    return best;
  }

  function isSameConnectorAnchor(
    anchorA: ConnectorAnchorIgnore,
    anchorB: ConnectorAnchorIgnore,
  ): boolean {
    return (
      anchorA.objectId === anchorB.objectId &&
      Math.abs(anchorA.anchorX - anchorB.anchorX) <= SHAPE_ANCHOR_MATCH_EPSILON &&
      Math.abs(anchorA.anchorY - anchorB.anchorY) <= SHAPE_ANCHOR_MATCH_EPSILON
    );
  }

  function findConnectorAttachment(
    worldPosition: { x: number; y: number },
    connectorId: string,
    ignoreAnchor?: ConnectorAnchorIgnore,
    currentAnchor?: ConnectorAnchorIgnore,
  ): ConnectorAttachmentResult | null {
    const stageScale = stageRef.current?.scaleX() || 1;
    const snapDistance = CONNECTOR_SNAP_DISTANCE_PX / Math.max(0.1, stageScale);
    const snapReleaseDistance =
      (CONNECTOR_SNAP_DISTANCE_PX + CONNECTOR_SNAP_RELEASE_BUFFER_PX) / Math.max(0.1, stageScale);

    if (
      currentAnchor &&
      (!ignoreAnchor || !isSameConnectorAnchor(currentAnchor, ignoreAnchor))
    ) {
      const currentObject = objectsRef.current.get(currentAnchor.objectId);
      if (currentObject && currentObject.type !== 'connector') {
        const currentPoint = resolveObjectAnchorPoint(
          currentObject,
          currentAnchor.anchorX,
          currentAnchor.anchorY,
        );
        const distance = Math.hypot(
          worldPosition.x - currentPoint.x,
          worldPosition.y - currentPoint.y,
        );
        if (distance <= snapReleaseDistance) {
          return {
            objectId: currentAnchor.objectId,
            x: currentPoint.x,
            y: currentPoint.y,
            anchorX: currentAnchor.anchorX,
            anchorY: currentAnchor.anchorY,
          };
        }
      }
    }

    let bestMatch: ConnectorAttachmentCandidate | null = null;

    objectsRef.current.forEach((entry) => {
      if (entry.id === connectorId || entry.type === 'connector') {
        return;
      }

      const candidate = findClosestAnchorForObject(entry, worldPosition);
      if (!candidate || candidate.distance > snapDistance) {
        return;
      }

      if (
        ignoreAnchor &&
        isSameConnectorAnchor(ignoreAnchor, {
          objectId: candidate.objectId,
          anchorX: candidate.anchorX,
          anchorY: candidate.anchorY,
        })
      ) {
        return;
      }

      if (!bestMatch || candidate.distance < bestMatch.distance) {
        bestMatch = candidate;
      }
    });

    if (!bestMatch) {
      return null;
    }

    const { objectId, x, y, anchorX, anchorY } = bestMatch;
    return { objectId, x, y, anchorX, anchorY };
  }

  function updateConnectorEndpoint(
    connectorId: string,
    endpoint: ConnectorEndpoint,
    worldPosition: { x: number; y: number },
    persist: boolean,
    emitRealtime = persist,
    options?: { detachFromCurrentAnchor?: boolean; snapDuringDrag?: boolean },
  ) {
    const current = objectsRef.current.get(connectorId);
    if (!current || current.type !== 'connector') {
      return;
    }

    const [startX, startY, endX, endY] = getConnectorPoints(current);
    const next: BoardObject = {
      ...current,
      updatedAt: persist ? new Date().toISOString() : current.updatedAt,
    };
    const currentAnchorX = endpoint === 'from' ? current.fromAnchorX : current.toAnchorX;
    const currentAnchorY = endpoint === 'from' ? current.fromAnchorY : current.toAnchorY;
    const currentObjectId = endpoint === 'from' ? current.fromId : current.toId;
    const currentAnchor =
      currentObjectId &&
      Number.isFinite(currentAnchorX) &&
      Number.isFinite(currentAnchorY)
        ? {
            objectId: currentObjectId,
            anchorX: Number(currentAnchorX),
            anchorY: Number(currentAnchorY),
          }
        : undefined;
    const ignoredAnchor =
      options?.detachFromCurrentAnchor && currentAnchor
        ? currentAnchor
        : undefined;
    const shouldSnap = options?.snapDuringDrag !== false;
    const attachment = shouldSnap
      ? findConnectorAttachment(worldPosition, connectorId, ignoredAnchor, currentAnchor)
      : null;

    if (endpoint === 'from') {
      if (attachment) {
        next.fromId = attachment.objectId;
        next.fromAnchorX = attachment.anchorX;
        next.fromAnchorY = attachment.anchorY;
      } else {
        next.fromId = '';
        next.fromAnchorX = undefined;
        next.fromAnchorY = undefined;
      }
    } else if (attachment) {
      next.toId = attachment.objectId;
      next.toAnchorX = attachment.anchorX;
      next.toAnchorY = attachment.anchorY;
    } else {
      next.toId = '';
      next.toAnchorX = undefined;
      next.toAnchorY = undefined;
    }

    const fallbackPoints =
      endpoint === 'from'
        ? [attachment?.x ?? worldPosition.x, attachment?.y ?? worldPosition.y, endX, endY]
        : [startX, startY, attachment?.x ?? worldPosition.x, attachment?.y ?? worldPosition.y];

    const from = next.fromId ? objectsRef.current.get(next.fromId) : undefined;
    const to = next.toId ? objectsRef.current.get(next.toId) : undefined;
    const resolvedPoints = resolveConnectorPoints({
      from,
      to,
      fromAnchorX: next.fromAnchorX,
      fromAnchorY: next.fromAnchorY,
      toAnchorX: next.toAnchorX,
      toAnchorY: next.toAnchorY,
      fallback: fallbackPoints,
    });

    const nextObject: BoardObject = {
      ...next,
      x: 0,
      y: 0,
      points: resolvedPoints,
      width: Math.max(1, Math.abs((resolvedPoints[2] || 0) - (resolvedPoints[0] || 0))),
      height: Math.max(1, Math.abs((resolvedPoints[3] || 0) - (resolvedPoints[1] || 0))),
    };

    objectsRef.current.set(connectorId, nextObject);
    const node = stageRef.current?.findOne(`#${connectorId}`);
    if (node instanceof Konva.Line || node instanceof Konva.Arrow) {
      node.points(resolvedPoints);
      if (nextObject.style === 'dashed') {
        node.dash([10, 6]);
      } else {
        node.dash([]);
      }
    }

    objectsLayerRef.current?.batchDraw();
    setBoardRevision((value) => value + 1);
    if (emitRealtime) {
      emitObjectUpdate(nextObject, persist);
    }
    if (persist) {
      aiExecutor.invalidateUndo();
      scheduleBoardSave();
    }
  }

  function syncConnectedConnectors(changedObjectId: string, persist: boolean, emitRealtime: boolean) {
    const relatedConnectors = Array.from(objectsRef.current.values()).filter(
      (entry) =>
        entry.type === 'connector' &&
        (entry.fromId === changedObjectId || entry.toId === changedObjectId),
    );

    if (relatedConnectors.length === 0) {
      return;
    }

    relatedConnectors.forEach((connector) => {
      const from = connector.fromId ? objectsRef.current.get(connector.fromId) : undefined;
      const to = connector.toId ? objectsRef.current.get(connector.toId) : undefined;
      const nextPoints = resolveConnectorPoints({
        from,
        to,
        fromAnchorX: connector.fromAnchorX,
        fromAnchorY: connector.fromAnchorY,
        toAnchorX: connector.toAnchorX,
        toAnchorY: connector.toAnchorY,
        fallback: connector.points || [connector.x, connector.y, connector.x + connector.width, connector.y],
      });

      const nextObject: BoardObject = {
        ...connector,
        points: nextPoints,
        x: 0,
        y: 0,
        width: Math.abs((nextPoints[2] || 0) - (nextPoints[0] || 0)),
        height: Math.abs((nextPoints[3] || 0) - (nextPoints[1] || 0)),
        updatedAt: persist ? new Date().toISOString() : connector.updatedAt,
      };
      objectsRef.current.set(nextObject.id, nextObject);

      const node = stageRef.current?.findOne(`#${nextObject.id}`);
      if (node instanceof Konva.Line || node instanceof Konva.Arrow) {
        node.points(nextPoints);
        if (nextObject.style === 'dashed') {
          node.dash([10, 6]);
        } else {
          node.dash([]);
        }
      }

      if (emitRealtime) {
        emitObjectUpdate(nextObject, persist);
      }
    });
    objectsLayerRef.current?.batchDraw();
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
    let points = current.points;
    let fontSize = current.fontSize;
    let text = current.text;
    let title = current.title;

    if (current.type === 'sticky' && node instanceof Konva.Group) {
      const body = node.findOne('.sticky-body') as Konva.Rect | null;
      if (body) {
        width = body.width();
        height = body.height();
      }
    }

    if ((current.type === 'rect' || current.type === 'circle') && node instanceof Konva.Rect) {
      width = node.width();
      height = node.height();
      if (current.type === 'circle') {
        const size = Math.max(RECT_MIN_SIZE, Math.max(width, height));
        const centerX = node.x() + width / 2;
        const centerY = node.y() + height / 2;
        node.position({
          x: centerX - size / 2,
          y: centerY - size / 2,
        });
        node.width(size);
        node.height(size);
        node.cornerRadius(size / 2);
        width = size;
        height = size;
      }
    }

    if (current.type === 'line' && (node instanceof Konva.Line || node instanceof Konva.Arrow)) {
      points = node.points();
      width = Math.abs((points[2] || 0) - (points[0] || 0));
      height = Math.abs((points[3] || 0) - (points[1] || 0));
    }

    if (current.type === 'text' && node instanceof Konva.Text) {
      width = node.width();
      height = node.height();
      text = node.text();
      fontSize = node.fontSize();
    }

    if (current.type === 'frame' && node instanceof Konva.Group) {
      const body = node.findOne('.frame-body') as Konva.Rect | null;
      const frameTitle = node.findOne('.frame-title') as Konva.Text | null;
      if (body) {
        width = body.width();
        height = body.height();
      }
      if (frameTitle) {
        title = frameTitle.text();
      }
    }

    const nextObject: BoardObject = {
      ...current,
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      width,
      height,
      points,
      fontSize,
      text,
      title,
      updatedAt: persist ? new Date().toISOString() : current.updatedAt,
    };

    objectsRef.current.set(objectId, nextObject);
    if (current.type !== 'connector') {
      syncConnectedConnectors(objectId, persist, emitRealtime);
    }

    if (bumpRevision) {
      setBoardRevision((value) => value + 1);
    }
    if (emitRealtime) {
      emitObjectUpdate(nextObject, persist);
    }
    if (persist) {
      aiExecutor.invalidateUndo();
      scheduleBoardSave();
    }
  }

  function openTextEditor(objectId: string) {
    if (!canEditBoard) {
      return;
    }

    const object = objectsRef.current.get(objectId);
    if (!object || (object.type !== 'sticky' && object.type !== 'text')) {
      return;
    }

    setEditingText({
      id: objectId,
      value: object.type === 'sticky' ? (isPlaceholderStickyText(object.text) ? '' : object.text || '') : object.text || '',
    });
  }

  function handleObjectSelection(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>, objectId: string) {
    event.cancelBubble = true;
    if (activeTool === 'connector') {
      return;
    }

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

  function handleObjectDragStart(objectId: string) {
    if (activeTool !== 'select') {
      return;
    }

    setSelectedIds((previous) =>
      previous.length === 1 && previous[0] === objectId ? previous : [objectId],
    );
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
    group.on('dragstart', () => {
      handleObjectDragStart(object.id);
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
    rect.on('dragstart', () => {
      handleObjectDragStart(object.id);
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

  function createCircleNode(object: BoardObject): Konva.Rect {
    const circle = new Konva.Rect({
      id: object.id,
      name: 'board-object circle-object',
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
      fill: object.color,
      stroke: object.stroke || RECT_DEFAULT_STROKE,
      strokeWidth: object.strokeWidth || RECT_DEFAULT_STROKE_WIDTH,
      cornerRadius: Math.min(object.width, object.height) / 2,
      rotation: object.rotation,
      draggable: false,
    });

    circle.on('click tap', (event) => {
      handleObjectSelection(event, object.id);
    });
    circle.on('dragstart', () => {
      handleObjectDragStart(object.id);
    });
    circle.on('dragmove', () => {
      syncObjectFromNode(object.id, false, true, false);
      const worldPosition = getWorldPointerPosition();
      if (worldPosition) {
        publishCursor(worldPosition);
      }
    });
    circle.on('dragend', () => {
      syncObjectFromNode(object.id, true);
    });
    circle.on('transformend', () => {
      const existing = objectsRef.current.get(object.id);
      if (!existing) {
        return;
      }

      applyCircleTransform(circle, existing);
      syncObjectFromNode(object.id, true);
      objectsLayerRef.current?.batchDraw();
    });

    return circle;
  }

  function createLineNode(object: BoardObject): Konva.Line {
    const line = new Konva.Line({
      id: object.id,
      name: 'board-object line-object',
      x: object.x,
      y: object.y,
      points: object.points || [0, 0, object.width, object.height],
      stroke: object.color || '#0f172a',
      strokeWidth: object.strokeWidth || 2,
      lineCap: 'round',
      lineJoin: 'round',
      draggable: false,
      rotation: object.rotation,
    });

    line.on('click tap', (event) => {
      handleObjectSelection(event, object.id);
    });
    line.on('dragstart', () => {
      handleObjectDragStart(object.id);
    });
    line.on('dragmove', () => {
      syncObjectFromNode(object.id, false, true, false);
      const worldPosition = getWorldPointerPosition();
      if (worldPosition) {
        publishCursor(worldPosition);
      }
    });
    line.on('dragend', () => {
      syncObjectFromNode(object.id, true);
    });
    line.on('transformend', () => {
      applyLineTransform(line);
      syncObjectFromNode(object.id, true);
      objectsLayerRef.current?.batchDraw();
    });

    return line;
  }

  function createTextNode(object: BoardObject): Konva.Text {
    const textNode = new Konva.Text({
      id: object.id,
      name: 'board-object text-object',
      x: object.x,
      y: object.y,
      text: object.text || 'Text',
      width: object.width,
      height: object.height,
      fill: object.color || TEXT_DEFAULT_COLOR,
      fontSize: object.fontSize || TEXT_DEFAULT_FONT_SIZE,
      fontFamily: 'Segoe UI, sans-serif',
      align: 'left',
      verticalAlign: 'top',
      padding: 6,
      draggable: false,
      rotation: object.rotation,
    });

    textNode.on('click tap', (event) => {
      handleObjectSelection(event, object.id);
    });
    textNode.on('dragstart', () => {
      handleObjectDragStart(object.id);
    });
    textNode.on('dragmove', () => {
      syncObjectFromNode(object.id, false, true, false);
      const worldPosition = getWorldPointerPosition();
      if (worldPosition) {
        publishCursor(worldPosition);
      }
    });
    textNode.on('dragend', () => {
      syncObjectFromNode(object.id, true);
    });
    textNode.on('transformend', () => {
      const existing = objectsRef.current.get(object.id);
      if (!existing) {
        return;
      }
      applyTextTransform(textNode, existing);
      syncObjectFromNode(object.id, true);
      objectsLayerRef.current?.batchDraw();
    });
    textNode.on('dblclick dbltap', () => {
      openTextEditor(object.id);
    });

    return textNode;
  }

  function createFrameNode(object: BoardObject): Konva.Group {
    const group = new Konva.Group({
      id: object.id,
      name: 'board-object frame-object',
      x: object.x,
      y: object.y,
      rotation: object.rotation,
      draggable: false,
    });

    const body = new Konva.Rect({
      name: 'frame-body',
      width: object.width,
      height: object.height,
      fill: object.color || '#fff',
      stroke: object.stroke || FRAME_DEFAULT_STROKE,
      strokeWidth: object.strokeWidth || 2,
      cornerRadius: 8,
      dash: [6, 4],
    });

    const title = new Konva.Text({
      name: 'frame-title',
      x: 10,
      y: 8,
      width: Math.max(60, object.width - 20),
      text: object.title || 'Frame',
      fill: '#1f2937',
      fontSize: 14,
      fontStyle: 'bold',
      fontFamily: 'Segoe UI, sans-serif',
    });

    group.add(body);
    group.add(title);
    group.on('click tap', (event) => {
      handleObjectSelection(event, object.id);
    });
    group.on('dragstart', () => {
      handleObjectDragStart(object.id);
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
      applyFrameTransform(group, existing);
      syncObjectFromNode(object.id, true);
      objectsLayerRef.current?.batchDraw();
    });

    return group;
  }

  function createConnectorNode(object: BoardObject): Konva.Line | Konva.Arrow {
    const points = object.points || [0, 0, object.width, object.height];
    const common = {
      id: object.id,
      name: 'board-object connector-object',
      points,
      stroke: object.color || '#64748b',
      strokeWidth: object.strokeWidth || 2,
      hitStrokeWidth: 20,
      lineCap: 'round' as const,
      lineJoin: 'round' as const,
      listening: true,
      draggable: false,
    };

    const connector =
      object.style === 'arrow'
        ? new Konva.Arrow({
            ...common,
            pointerLength: 8,
            pointerWidth: 8,
          })
        : new Konva.Line({
            ...common,
            dash: object.style === 'dashed' ? [10, 6] : [],
          });

    connector.on('click tap', (event) => {
      handleObjectSelection(event, object.id);
    });

    return connector;
  }

  function createNodeForObject(object: BoardObject): BoardCanvasNode {
    switch (object.type) {
      case 'sticky':
        return createStickyNode(object);
      case 'rect':
        return createRectNode(object);
      case 'circle':
        return createCircleNode(object);
      case 'line':
        return createLineNode(object);
      case 'text':
        return createTextNode(object);
      case 'frame':
        return createFrameNode(object);
      case 'connector':
        return createConnectorNode(object);
      default:
        return createRectNode(object);
    }
  }

  function insertObject(object: BoardObject, persist: boolean) {
    if (persist && !canEditBoard) {
      return;
    }

    objectsRef.current.set(object.id, object);
    const node = createNodeForObject(object);
    objectsLayerRef.current?.add(node);
    syncObjectsLayerZOrder();
    objectsLayerRef.current?.batchDraw();
    setObjectCount(objectsRef.current.size);
    setBoardRevision((value) => value + 1);

    if (persist) {
      aiExecutor.invalidateUndo();
      emitObjectCreate(object);
      scheduleBoardSave();
    }
  }

  function removeObjects(objectIds: string[], persist: boolean) {
    if (objectIds.length === 0) {
      return;
    }

    if (persist && !canEditBoard) {
      return;
    }

    const removeSet = new Set(objectIds);
    objectIds.forEach((objectId) => {
      const node = stageRef.current?.findOne(`#${objectId}`);
      node?.destroy();
      objectsRef.current.delete(objectId);
    });

    syncObjectsLayerZOrder();
    objectsLayerRef.current?.batchDraw();
    setSelectedIds((previous) => previous.filter((entry) => !removeSet.has(entry)));
    setObjectCount(objectsRef.current.size);
    setEditingText((previous) => (previous && removeSet.has(previous.id) ? null : previous));
    setBoardRevision((value) => value + 1);

    if (persist) {
      aiExecutor.invalidateUndo();
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

    if (saveChanges && !canEditBoard) {
      setEditingText(null);
      return;
    }

    const current = objectsRef.current.get(editingText.id);
    if (!current || (current.type !== 'sticky' && current.type !== 'text')) {
      setEditingText(null);
      return;
    }

    const node = stageRef.current?.findOne(`#${editingText.id}`);
    const stickyLabel =
      node instanceof Konva.Group ? ((node.findOne('.sticky-label') as Konva.Text | null) ?? null) : null;
    const textNode = node instanceof Konva.Text ? node : null;
    const text = editingText.value;
    const normalizedText = text.replace(/\r\n/g, '\n');
    const nextText = saveChanges ? normalizedText : current.text || '';

    const nextObject: BoardObject = {
      ...current,
      text: nextText,
      updatedAt: saveChanges ? new Date().toISOString() : current.updatedAt,
    };

    objectsRef.current.set(editingText.id, nextObject);

    if (current.type === 'sticky') {
      stickyLabel?.text(getStickyRenderText(nextText));
      stickyLabel?.fill(getStickyRenderColor(nextText));
    } else {
      textNode?.text(nextText || 'Text');
    }
    objectsLayerRef.current?.batchDraw();
    setEditingText(null);
    setBoardRevision((value) => value + 1);

    if (saveChanges) {
      aiExecutor.invalidateUndo();
      emitObjectUpdate(nextObject, true);
      scheduleBoardSave();
    }
  }

  function createStickyAt(worldPosition: { x: number; y: number }) {
    if (!canEditBoard) {
      return;
    }

    const object = createDefaultObject('sticky', {
      x: worldPosition.x,
      y: worldPosition.y,
      zIndex: getNextZIndex(),
      createdBy: user?.uid || 'guest',
      text: '',
      color: STICKY_DEFAULT_COLOR,
      width: STICKY_DEFAULT_WIDTH,
      height: STICKY_DEFAULT_HEIGHT,
    });

    insertObject(object, true);
    setSelectedIds([object.id]);
    setActiveTool('select');
  }

  function createTextAt(worldPosition: { x: number; y: number }) {
    if (!canEditBoard) {
      return;
    }

    const object = createDefaultObject('text', {
      x: worldPosition.x,
      y: worldPosition.y,
      text: 'Text',
      zIndex: getNextZIndex(),
      createdBy: user?.uid || 'guest',
    });

    insertObject(object, true);
    setSelectedIds([object.id]);
    openTextEditor(object.id);
    setActiveTool('select');
  }

  function createFrameAt(worldPosition: { x: number; y: number }) {
    if (!canEditBoard) {
      return;
    }

    const object = createDefaultObject('frame', {
      x: worldPosition.x,
      y: worldPosition.y,
      title: 'Frame',
      zIndex: getNextZIndex(),
      createdBy: user?.uid || 'guest',
    });

    insertObject(object, true);
    setSelectedIds([object.id]);
    setActiveTool('select');
  }

  function beginConnectorDraft(
    worldPosition: { x: number; y: number },
    startAttachment?: ConnectorAttachmentResult,
  ) {
    if (!canEditBoard) {
      return;
    }

    if (connectorDraftRef.current) {
      return;
    }

    const initialAttachment = startAttachment || findConnectorAttachment(worldPosition, '');
    const start = initialAttachment || {
      x: worldPosition.x,
      y: worldPosition.y,
    };
    const startX = start.x;
    const startY = start.y;
    const object = createDefaultObject('connector', {
      x: 0,
      y: 0,
      points: [startX, startY, startX + 1, startY],
      fromId: initialAttachment?.objectId || '',
      fromAnchorX: initialAttachment?.anchorX,
      fromAnchorY: initialAttachment?.anchorY,
      toId: '',
      toAnchorX: undefined,
      toAnchorY: undefined,
      zIndex: getNextZIndex(),
      createdBy: user?.uid || 'guest',
    });

    insertObject(object, false);
    connectorDraftRef.current = {
      id: object.id,
      startX: start.x,
      startY: start.y,
    };
    setIsDrawingConnector(true);
    setSelectedIds([object.id]);
  }

  function updateConnectorDraft(worldPosition: { x: number; y: number }) {
    const draft = connectorDraftRef.current;
    if (!draft) {
      return;
    }

    updateConnectorEndpoint(draft.id, 'to', worldPosition, false, false, {
      snapDuringDrag: false,
    });
  }

  function finalizeConnectorDraft() {
    const draft = connectorDraftRef.current;
    if (!draft) {
      return;
    }

    const current = objectsRef.current.get(draft.id);
    const node = stageRef.current?.findOne(`#${draft.id}`);
    if (!current || current.type !== 'connector' || !(node instanceof Konva.Line || node instanceof Konva.Arrow)) {
      connectorDraftRef.current = null;
      setIsDrawingConnector(false);
      return;
    }

    const points = node.points();
    const startX = points[0] || draft.startX;
    const startY = points[1] || draft.startY;
    const endX = points[2] || startX;
    const endY = points[3] || startY;
    const length = Math.hypot(endX - startX, endY - startY);

    let nextObject = current;
    if (length < RECT_CLICK_DRAG_THRESHOLD) {
      const clickPoints = [startX, startY, startX + LINE_CLICK_DEFAULT_WIDTH, startY];
      node.points(clickPoints);
      nextObject = {
        ...current,
        points: clickPoints,
        toId: '',
        toAnchorX: undefined,
        toAnchorY: undefined,
        width: LINE_CLICK_DEFAULT_WIDTH,
        height: 1,
      };
    } else {
      updateConnectorEndpoint(
        draft.id,
        'to',
        { x: endX, y: endY },
        false,
        false,
        { snapDuringDrag: true },
      );
      const snapped = objectsRef.current.get(draft.id);
      const snappedNode = stageRef.current?.findOne(`#${draft.id}`);
      const snappedPoints =
        snappedNode instanceof Konva.Line || snappedNode instanceof Konva.Arrow
          ? snappedNode.points()
          : points;
      const snappedStartX = snappedPoints[0] || startX;
      const snappedStartY = snappedPoints[1] || startY;
      const snappedEndX = snappedPoints[2] || endX;
      const snappedEndY = snappedPoints[3] || endY;
      nextObject = {
        ...(snapped?.type === 'connector' ? snapped : current),
        points: snappedPoints,
        width: Math.max(1, Math.abs(snappedEndX - snappedStartX)),
        height: Math.max(1, Math.abs(snappedEndY - snappedStartY)),
      };
    }

    nextObject = {
      ...nextObject,
      updatedAt: new Date().toISOString(),
    };

    objectsRef.current.set(nextObject.id, nextObject);
    connectorDraftRef.current = null;
    setIsDrawingConnector(false);
    setActiveTool('select');
    setSelectedIds([nextObject.id]);
    setBoardRevision((value) => value + 1);
    aiExecutor.invalidateUndo();
    emitObjectCreate(nextObject);
    scheduleBoardSave();
    objectsLayerRef.current?.batchDraw();
    setCanvasNotice(null);
  }

  function beginShapeDraft(worldPosition: { x: number; y: number }, type: 'rect' | 'circle' | 'line') {
    if (!canEditBoard) {
      return;
    }

    const object =
      type === 'line'
        ? createDefaultObject('line', {
            x: worldPosition.x,
            y: worldPosition.y,
            points: [0, 0, 1, 1],
            width: 1,
            height: 1,
            zIndex: getNextZIndex(),
            createdBy: user?.uid || 'guest',
          })
        : createDefaultObject(type, {
            x: worldPosition.x,
            y: worldPosition.y,
            width: 1,
            height: 1,
            zIndex: getNextZIndex(),
            createdBy: user?.uid || 'guest',
          });

    insertObject(object, false);
    rectDraftRef.current = {
      id: object.id,
      startX: worldPosition.x,
      startY: worldPosition.y,
      type,
    };
    setIsDrawingRect(true);
    setSelectedIds([object.id]);
  }

  function updateShapeDraft(worldPosition: { x: number; y: number }) {
    const draft = rectDraftRef.current;
    if (!draft) {
      return;
    }

    const current = objectsRef.current.get(draft.id);
    const node = stageRef.current?.findOne(`#${draft.id}`);
    if (!current || !node) {
      return;
    }

    if (draft.type === 'line' && (node instanceof Konva.Line || node instanceof Konva.Arrow)) {
      const dx = worldPosition.x - draft.startX;
      const dy = worldPosition.y - draft.startY;
      const points = [0, 0, dx, dy];
      node.setAttrs({
        x: draft.startX,
        y: draft.startY,
        points,
      });
      objectsRef.current.set(draft.id, {
        ...current,
        x: draft.startX,
        y: draft.startY,
        points,
        width: Math.max(1, Math.abs(dx)),
        height: Math.max(1, Math.abs(dy)),
      });
    } else if (node instanceof Konva.Rect) {
      if (draft.type === 'circle') {
        const dx = worldPosition.x - draft.startX;
        const dy = worldPosition.y - draft.startY;
        const size = Math.max(1, Math.abs(dx), Math.abs(dy));
        const x = dx < 0 ? draft.startX - size : draft.startX;
        const y = dy < 0 ? draft.startY - size : draft.startY;
        node.setAttrs({ x, y, width: size, height: size, cornerRadius: size / 2 });
        objectsRef.current.set(draft.id, {
          ...current,
          x,
          y,
          width: size,
          height: size,
          radius: size / 2,
        });
      } else {
        const x = Math.min(draft.startX, worldPosition.x);
        const y = Math.min(draft.startY, worldPosition.y);
        const width = Math.max(1, Math.abs(worldPosition.x - draft.startX));
        const height = Math.max(1, Math.abs(worldPosition.y - draft.startY));
        node.setAttrs({ x, y, width, height });
        objectsRef.current.set(draft.id, {
          ...current,
          x,
          y,
          width,
          height,
        });
      }
    }
    objectsLayerRef.current?.batchDraw();
  }

  function finalizeShapeDraft() {
    const draft = rectDraftRef.current;
    if (!draft) {
      return;
    }

    const current = objectsRef.current.get(draft.id);
    const node = stageRef.current?.findOne(`#${draft.id}`);
    if (!current || !node) {
      rectDraftRef.current = null;
      setIsDrawingRect(false);
      return;
    }

    const isClickCreate =
      current.width < RECT_CLICK_DRAG_THRESHOLD && current.height < RECT_CLICK_DRAG_THRESHOLD;
    let width = current.width;
    let height = current.height;
    let points = current.points;

    if (draft.type === 'line' && (node instanceof Konva.Line || node instanceof Konva.Arrow)) {
      if (isClickCreate) {
        points = [0, 0, LINE_CLICK_DEFAULT_WIDTH, 0];
        node.points(points);
        width = LINE_CLICK_DEFAULT_WIDTH;
        height = 1;
      } else {
        points = node.points();
        width = Math.max(1, Math.abs((points[2] || 0) - (points[0] || 0)));
        height = Math.max(1, Math.abs((points[3] || 0) - (points[1] || 0)));
      }
    } else if (node instanceof Konva.Rect) {
      width = isClickCreate
        ? draft.type === 'circle'
          ? CIRCLE_CLICK_DEFAULT_SIZE
          : RECT_CLICK_DEFAULT_WIDTH
        : Math.max(RECT_MIN_SIZE, current.width);
      height = isClickCreate
        ? draft.type === 'circle'
          ? CIRCLE_CLICK_DEFAULT_SIZE
          : RECT_CLICK_DEFAULT_HEIGHT
        : Math.max(RECT_MIN_SIZE, current.height);
      if (draft.type === 'circle') {
        const size = Math.max(width, height);
        width = size;
        height = size;
        node.setAttrs({ width: size, height: size, cornerRadius: size / 2 });
      } else {
        node.setAttrs({ width, height });
      }
    }

    const finalizedObject: BoardObject = {
      ...current,
      width,
      height,
      points,
      radius: draft.type === 'circle' ? Math.min(width, height) / 2 : current.radius,
      updatedAt: new Date().toISOString(),
    };
    objectsRef.current.set(draft.id, finalizedObject);

    rectDraftRef.current = null;
    setIsDrawingRect(false);
    setActiveTool('select');
    setSelectedIds([draft.id]);
    setBoardRevision((value) => value + 1);
    aiExecutor.invalidateUndo();
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
      const objectBounds = getObjectBounds(entry);

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

    if (!canEditBoard) {
      return;
    }

    if (activeTool === 'connector') {
      beginConnectorDraft(worldPosition);
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

    if (activeTool === 'text') {
      createTextAt(worldPosition);
      return;
    }

    if (activeTool === 'frame') {
      createFrameAt(worldPosition);
      return;
    }

    if (activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line') {
      beginShapeDraft(worldPosition, activeTool);
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
      updateShapeDraft(worldPosition);
    }

    if (connectorDraftRef.current) {
      updateConnectorDraft(worldPosition);
    }

    if (selectionDraftRef.current) {
      updateSelection(worldPosition);
    }
  }

  function handleStageMouseUp() {
    if (connectorDraftRef.current) {
      finalizeConnectorDraft();
    }

    if (rectDraftRef.current) {
      finalizeShapeDraft();
    }

    if (selectionDraftRef.current) {
      finalizeSelection();
    }
  }

  function handleStageMouseLeave() {
    publishCursorHide();

    if (connectorDraftRef.current) {
      finalizeConnectorDraft();
    }

    if (rectDraftRef.current) {
      finalizeShapeDraft();
    }

    if (selectionDraftRef.current) {
      finalizeSelection();
    }
  }

  function getSelectedConnectorHandle(endpoint: ConnectorEndpoint): { x: number; y: number } | null {
    if (!selectedConnector) {
      return null;
    }

    const connectorNode = stageRef.current?.findOne(`#${selectedConnector.id}`);
    const livePoints =
      connectorNode instanceof Konva.Line || connectorNode instanceof Konva.Arrow
        ? connectorNode.points()
        : selectedConnector.points;
    const points = livePoints && livePoints.length >= 4 ? livePoints : getConnectorPoints(selectedConnector);
    const [startX, startY, endX, endY] = [points[0] || 0, points[1] || 0, points[2] || 0, points[3] || 0];
    if (endpoint === 'from') {
      return { x: startX, y: startY };
    }

    return { x: endX, y: endY };
  }

  function handleConnectorHandleDragStart(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    event.cancelBubble = true;
    if (!canEditBoard) {
      return;
    }
    setIsDraggingConnectorHandle(true);
  }

  function handleConnectorHandleDragMove(
    endpoint: ConnectorEndpoint,
    event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  ) {
    event.cancelBubble = true;
    if (!canEditBoard) {
      return;
    }
    if (!selectedConnector) {
      return;
    }

    const target = event.target;
    const nextPosition = { x: target.x(), y: target.y() };
    updateConnectorEndpoint(
      selectedConnector.id,
      endpoint,
      nextPosition,
      false,
      true,
      { detachFromCurrentAnchor: true, snapDuringDrag: false },
    );
    const worldPosition = getWorldPointerPosition();
    if (worldPosition) {
      publishCursor(worldPosition);
    } else {
      publishCursor(nextPosition);
    }
  }

  function handleConnectorHandleDragEnd(
    endpoint: ConnectorEndpoint,
    event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  ) {
    event.cancelBubble = true;
    if (!canEditBoard) {
      setIsDraggingConnectorHandle(false);
      return;
    }
    const connector = selectedConnector;
    setIsDraggingConnectorHandle(false);
    if (!connector) {
      return;
    }

    const target = event.target;
    const nextPosition = { x: target.x(), y: target.y() };
    updateConnectorEndpoint(
      connector.id,
      endpoint,
      nextPosition,
      true,
      true,
      { detachFromCurrentAnchor: true, snapDuringDrag: true },
    );
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
    scheduleViewportSave();
    setBoardRevision((value) => value + 1);
  }

  function handleStageDragEnd() {
    scheduleViewportSave();
  }

  const handleSaveTitle = async () => {
    if (!boardId) {
      return;
    }

    if (!canEditBoard) {
      setTitleError('Only editors can rename this board.');
      setEditingTitle(false);
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

  const handleShareBoard = async () => {
    if (!boardId) {
      return;
    }

    const shareUrl =
      typeof window === 'undefined'
        ? `/board/${boardId}`
        : new URL(`/board/${boardId}`, window.location.origin).toString();

    let copied = false;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied) {
      copied = fallbackCopyToClipboard(shareUrl);
    }

    if (copied) {
      setShareState('copied');
      setCanvasNotice('Share link copied to clipboard.');
    } else {
      setShareState('error');
      setCanvasNotice('Clipboard access blocked. Copy the URL from your address bar.');
    }

    if (shareFeedbackTimeoutRef.current) {
      window.clearTimeout(shareFeedbackTimeoutRef.current);
    }
    shareFeedbackTimeoutRef.current = window.setTimeout(() => {
      setShareState('idle');
      shareFeedbackTimeoutRef.current = null;
    }, SHARE_FEEDBACK_RESET_MS);
  };

  if (!boardId) {
    return <div className="centered-screen">Board unavailable.</div>;
  }

  if (isResolvingAccess) {
    return <div className="centered-screen">Checking board access...</div>;
  }

  if (boardMissing) {
    return (
      <main className="centered-screen">
        <div>
          <p>Board not found.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
            <button className="secondary-btn" onClick={() => navigate('/dashboard')}>
              Back to dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!canReadBoard) {
    return (
      <main className="centered-screen">
        <div>
          <p>You do not have access to this board.</p>
          <p className="landing-muted">
            {user
              ? 'Ask the board owner to grant access, or use a permitted share link.'
              : 'Sign in first, then retry this board link.'}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
            {user ? (
              <button className="secondary-btn" onClick={() => navigate('/dashboard')}>
                Back to dashboard
              </button>
            ) : (
              <button
                className="primary-btn"
                onClick={() =>
                  navigate(`/?returnTo=${encodeURIComponent(buildBoardReturnToPath(boardId))}`)
                }
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </main>
    );
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
    canvasNotice ||
    titleError ||
    (canEditBoard
      ? 'Select a tool from the left rail to start adding objects.'
      : 'Read-only mode. You can pan, zoom, and inspect this board.');
  const gridCellSize = Math.max(8, Math.min(72, 24 * (zoomPercent / 100)));
  const connectorFromHandle = getSelectedConnectorHandle('from');
  const connectorToHandle = getSelectedConnectorHandle('to');

  return (
    <main className="figma-board-root">
      <ReconnectBanner status={socketStatus} disconnectedSinceMs={disconnectedSinceMs} />
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
              {canEditBoard ? (
                <button
                  className="chip-btn"
                  onClick={() => {
                    setEditingTitle(true);
                    setTitleDraft(boardTitle);
                  }}
                >
                  Rename
                </button>
              ) : (
                <span className="chip-btn" aria-label="Board access role">
                  Viewer
                </span>
              )}
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
          <button className="secondary-btn" onClick={() => void handleShareBoard()}>
            {shareState === 'copied' ? 'Copied' : shareState === 'error' ? 'Copy failed' : 'Share'}
          </button>
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
            disabled={!canEditBoard}
            onClick={() => setActiveTool('sticky')}
          >
            □
          </button>
          <button
            className={`rail-btn ${activeTool === 'rect' ? 'active' : ''}`}
            aria-label="Rectangle tool"
            disabled={!canEditBoard}
            onClick={() => setActiveTool('rect')}
          >
            ○
          </button>
          <button
            className={`rail-btn ${activeTool === 'circle' ? 'active' : ''}`}
            aria-label="Circle tool"
            disabled={!canEditBoard}
            onClick={() => setActiveTool('circle')}
          >
            ◯
          </button>
          <button
            className={`rail-btn ${activeTool === 'line' ? 'active' : ''}`}
            aria-label="Line tool"
            disabled={!canEditBoard}
            onClick={() => setActiveTool('line')}
          >
            ／
          </button>
          <button
            className={`rail-btn ${activeTool === 'text' ? 'active' : ''}`}
            aria-label="Text tool"
            disabled={!canEditBoard}
            onClick={() => setActiveTool('text')}
          >
            T
          </button>
          <button
            className={`rail-btn ${activeTool === 'frame' ? 'active' : ''}`}
            aria-label="Frame tool"
            disabled={!canEditBoard}
            onClick={() => setActiveTool('frame')}
          >
            ⌗
          </button>
          <button
            className={`rail-btn ${activeTool === 'connector' ? 'active' : ''}`}
            aria-label="Connector tool"
            disabled={!canEditBoard}
            onClick={() => setActiveTool('connector')}
          >
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
              draggable={
                activeTool === 'select' &&
                !editingText &&
                !isDrawingRect &&
                !isDrawingConnector &&
                !isSelecting &&
                !isDraggingConnectorHandle
              }
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
              onDragEnd={handleStageDragEnd}
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
                {connectorShapeAnchors
                  .filter((anchor) => anchor.endpoint === null)
                  .map((anchor) => (
                    <KonvaCircleShape
                      key={anchor.key}
                      x={anchor.x}
                      y={anchor.y}
                      radius={canStartConnectorFromAnchor ? SHAPE_ANCHOR_RADIUS + 1 : SHAPE_ANCHOR_RADIUS}
                      fill="#ffffff"
                      stroke="#93c5fd"
                      strokeWidth={1.5}
                      listening={canStartConnectorFromAnchor}
                      hitStrokeWidth={canStartConnectorFromAnchor ? 16 : 0}
                      onMouseDown={(event) => {
                        if (!canStartConnectorFromAnchor) {
                          return;
                        }
                        event.cancelBubble = true;
                        beginConnectorDraft(
                          { x: anchor.x, y: anchor.y },
                          {
                            objectId: anchor.objectId,
                            x: anchor.x,
                            y: anchor.y,
                            anchorX: anchor.anchorX,
                            anchorY: anchor.anchorY,
                          },
                        );
                      }}
                      onTouchStart={(event) => {
                        if (!canStartConnectorFromAnchor) {
                          return;
                        }
                        event.cancelBubble = true;
                        beginConnectorDraft(
                          { x: anchor.x, y: anchor.y },
                          {
                            objectId: anchor.objectId,
                            x: anchor.x,
                            y: anchor.y,
                            anchorX: anchor.anchorX,
                            anchorY: anchor.anchorY,
                          },
                        );
                      }}
                    />
                  ))}
                {selectedConnector && connectorFromHandle ? (
                  <KonvaCircleShape
                    x={connectorFromHandle.x}
                    y={connectorFromHandle.y}
                    radius={CONNECTOR_HANDLE_RADIUS}
                    fill={selectedConnector.fromId ? CONNECTOR_HANDLE_STROKE : '#ffffff'}
                    stroke={CONNECTOR_HANDLE_STROKE}
                    strokeWidth={2}
                    draggable={activeTool === 'select' && canEditBoard}
                    onMouseDown={(event) => {
                      event.cancelBubble = true;
                    }}
                    onTouchStart={(event) => {
                      event.cancelBubble = true;
                    }}
                    onDragStart={handleConnectorHandleDragStart}
                    onDragMove={(event) => handleConnectorHandleDragMove('from', event)}
                    onDragEnd={(event) => handleConnectorHandleDragEnd('from', event)}
                  />
                ) : null}
                {selectedConnector && connectorToHandle ? (
                  <KonvaCircleShape
                    x={connectorToHandle.x}
                    y={connectorToHandle.y}
                    radius={CONNECTOR_HANDLE_RADIUS}
                    fill={selectedConnector.toId ? CONNECTOR_HANDLE_STROKE : '#ffffff'}
                    stroke={CONNECTOR_HANDLE_STROKE}
                    strokeWidth={2}
                    draggable={activeTool === 'select' && canEditBoard}
                    onMouseDown={(event) => {
                      event.cancelBubble = true;
                    }}
                    onTouchStart={(event) => {
                      event.cancelBubble = true;
                    }}
                    onDragStart={handleConnectorHandleDragStart}
                    onDragMove={(event) => handleConnectorHandleDragMove('to', event)}
                    onDragEnd={(event) => handleConnectorHandleDragEnd('to', event)}
                  />
                ) : null}
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
                placeholder={
                  objectsRef.current.get(editingText.id)?.type === 'text'
                    ? 'Text'
                    : STICKY_PLACEHOLDER_TEXT
                }
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
            averageAIApplyLatencyMs={averageAIApplyLatencyMs}
            aiApplyCount={aiApplyCount}
            aiDedupeDrops={aiDedupeDrops}
            userCount={members.length}
            objectCount={objectCount}
            reconnectCount={reconnectCount}
            connectionStatus={socketStatus}
            connectedSinceMs={connectedSinceMs}
          />
        </section>

        <aside className="figma-right-panel">
          <AICommandCenter
            state={{
              prompt: aiCommandCenter.prompt,
              mode: aiCommandCenter.mode,
              loading: aiCommandCenter.loading,
              error: aiCommandCenter.error,
              message: aiCommandCenter.message,
              actions: aiCommandCenter.actions,
              applying: aiExecutor.applying,
              applyDisabled:
                !canApplyAI ||
                aiExecutor.applying ||
                aiCommandCenter.loading ||
                aiCommandCenter.actions.length === 0,
              canUndo: canApplyAI && aiExecutor.canUndo,
              executionError: aiExecutor.error,
              executionMessage: aiExecutor.message,
            }}
            disabled={!canApplyAI}
            disabledReason="AI requires signed-in editor access on this board."
            onPromptChange={aiCommandCenter.setPrompt}
            onModeChange={aiCommandCenter.setMode}
            onSubmit={() => {
              void handleSubmitAI();
            }}
            onApply={() => {
              void handleApplyAIPlan();
            }}
            onUndo={() => {
              void handleUndoAI();
            }}
            onRetry={() => {
              void handleRetryAI();
            }}
            onClear={aiCommandCenter.clearResult}
          />

          <section className="properties-panel">
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
                <button
                  className="danger-btn property-delete-btn"
                  disabled={!canEditBoard}
                  onClick={() => removeObjects(selectedIds, true)}
                >
                  Delete Selected
                </button>
              </>
            ) : selectedObject ? (
              <>
                <div className="property-row">
                  <span>Selection</span>
                  <strong>
                    {selectedObject.type === 'sticky'
                      ? 'Sticky Note'
                      : selectedObject.type === 'rect'
                        ? 'Rectangle'
                        : selectedObject.type === 'circle'
                          ? 'Circle'
                          : selectedObject.type === 'line'
                            ? 'Line'
                            : selectedObject.type === 'text'
                              ? 'Text'
                              : selectedObject.type === 'frame'
                                ? 'Frame'
                                : 'Connector'}
                  </strong>
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
                  disabled={!canEditBoard}
                  onClick={() => removeObjects([selectedObject.id], true)}
                >
                  Delete
                </button>
              </>
            ) : null}
          </section>
        </aside>
      </section>
    </main>
  );
}
