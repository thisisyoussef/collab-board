import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore/lite';
import Konva from 'konva';
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Circle as KonvaCircleShape,
  Layer,
  Rect as KonvaRectShape,
  Stage,
  Text as KonvaTextShape,
  Transformer,
} from 'react-konva';
import { useNavigate, useParams } from 'react-router-dom';
import { AICommandCenter } from '../components/AICommandCenter';
import { BoardInspectorPanel } from '../components/BoardInspectorPanel';
import { BoardToolDock, type BoardTool } from '../components/BoardToolDock';
import { BoardZoomChip } from '../components/BoardZoomChip';
import { MetricsOverlay } from '../components/MetricsOverlay';
import { PresenceAvatars } from '../components/PresenceAvatars';
import { ReconnectBanner } from '../components/ReconnectBanner';
import { RemoteCursors } from '../components/RemoteCursors';
import { ShareSettingsPanel } from '../components/ShareSettingsPanel';
import { useAuth } from '../hooks/useAuth';
import { useAICommandCenter } from '../hooks/useAICommandCenter';
import { useAIExecutor, type AICommitMeta } from '../hooks/useAIExecutor';
import { useBoardRecents } from '../hooks/useBoardRecents';
import { useBoardHistory } from '../hooks/useBoardHistory';
import { useBoardSharing } from '../hooks/useBoardSharing';
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
  CONNECTOR_DEFAULT_LABEL_BACKGROUND,
  CONNECTOR_DEFAULT_LABEL_POSITION,
  CONNECTOR_DEFAULT_END_ARROW,
  CONNECTOR_DEFAULT_PATH_TYPE,
  CONNECTOR_DEFAULT_START_ARROW,
  CONNECTOR_DEFAULT_STROKE_STYLE,
  createDefaultObject,
  FRAME_DEFAULT_STROKE,
  FRAME_MIN_HEIGHT,
  FRAME_MIN_WIDTH,
  getObjectSideAnchorCandidates,
  getObjectBounds,
  normalizeLoadedObject as normalizeBoardObject,
  RECT_DEFAULT_STROKE,
  RECT_DEFAULT_STROKE_WIDTH,
  RECT_MIN_SIZE,
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
import {
  getConnectorEndpoints,
  getPointAlongConnectorPath,
} from '../lib/connector-routing';
import { toFirestoreUserMessage, withFirestoreTimeout } from '../lib/firestore-client';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import {
  cloneObjects,
  relinkConnectors,
  serializeToClipboard,
  deserializeFromClipboard,
} from '../lib/board-clipboard';
import { loadViewportState, saveViewportState } from '../lib/viewport';
import {
  buildRealtimeEventSignature,
  createRealtimeDedupeCache,
} from '../lib/realtime-dedupe';
import { screenToWorld, worldToScreen } from '../lib/utils';
import type { BoardObject, BoardObjectsRecord } from '../types/board';
import type {
  BoardCanvasNode,
  BoardDocData,
  Bounds,
  ConnectorAttachmentResult,
  ConnectorDraftState,
  ConnectorEndpoint,
  ConnectorHoverLockState,
  ConnectorShapeAnchorMarker,
  EditingTextState,
  PendingRemoteObjectEvent,
  SelectionDraftState,
  ShapeDraftState,
} from '../types/board-canvas';
import type { AIActionPreview } from '../types/ai';
import type {
  ObjectCreatePayload,
  ObjectDeletePayload,
  RealtimeObjectEventMeta,
  ObjectUpdatePayload,
} from '../types/realtime';
import {
  AI_APPLY_LATENCY_SAMPLE_WINDOW,
  BOARD_HISTORY_MAX_ENTRIES,
  BOARD_SAVE_DEBOUNCE_MS,
  CIRCLE_CLICK_DEFAULT_SIZE,
  CONNECTOR_HANDLE_RADIUS,
  CONNECTOR_HANDLE_STROKE,
  CONNECTOR_HOVER_LOCK_DELAY_MS,
  CONNECTOR_LABEL_BACKGROUND_FILL,
  CONNECTOR_LABEL_BACKGROUND_STROKE,
  CONNECTOR_LABEL_FONT_FAMILY,
  CONNECTOR_LABEL_FONT_SIZE,
  CONNECTOR_PATH_HANDLE_RADIUS,
  LINE_CLICK_DEFAULT_WIDTH,
  OBJECT_LATENCY_SAMPLE_WINDOW,
  OBJECT_LATENCY_UI_UPDATE_MS,
  OBJECT_UPDATE_EMIT_THROTTLE_MS,
  REALTIME_DEDUPE_MAX_ENTRIES,
  REALTIME_DEDUPE_TTL_MS,
  RECT_CLICK_DEFAULT_HEIGHT,
  RECT_CLICK_DEFAULT_WIDTH,
  RECT_CLICK_DRAG_THRESHOLD,
  SHAPE_ANCHOR_MATCH_EPSILON,
  SHAPE_ANCHOR_RADIUS,
  SHARE_FEEDBACK_RESET_MS,
  STICKY_PLACEHOLDER_TEXT,
  VIEWPORT_SAVE_DEBOUNCE_MS,
} from '../lib/board-constants';
import {
  buildBoardReturnToPath,
  estimateConnectorLabelBounds,
  fallbackCopyToClipboard,
  getStickyRenderColor,
  getStickyRenderText,
  intersects,
  isPlaceholderStickyText,
} from '../lib/board-canvas-utils';
import {
  findConnectorAttachment,
  findHoveredShapeId,
  getConnectorArrowHead,
  getConnectorPathBounds,
  getConnectorPathType,
  getConnectorPoints,
  isConnectorDashed,
  resolveConnectorRenderPoints,
} from '../lib/board-connector-helpers';

type ActiveTool = BoardTool;

function normalizeLoadedObject(raw: unknown, fallbackUserId: string): BoardObject | null {
  return normalizeBoardObject(raw, fallbackUserId);
}

function sanitizeBoardObjectForFirestore(entry: BoardObject): BoardObject {
  return sanitizeBoardObject(entry);
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
  const connectorHoverLockRef = useRef<ConnectorHoverLockState | null>(null);
  const connectorHoverLockTimerRef = useRef<number | null>(null);
  const manualHistoryBaselineRef = useRef<BoardObjectsRecord | null>(null);

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
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'error'>('idle');

  const selectedObject =
    selectedIds.length === 1 ? objectsRef.current.get(selectedIds[0]) ?? null : null;
  const selectedObjects = selectedIds
    .map((id) => objectsRef.current.get(id))
    .filter((obj): obj is BoardObject => obj != null);
  const selectedConnector =
    selectedObject && selectedObject.type === 'connector' ? selectedObject : null;
  const canStartConnectorFromAnchor = canEditBoard && activeTool === 'connector';
  const showConnectorAnchors =
    canEditBoard &&
    (activeTool === 'connector' ||
      Boolean(selectedConnector) ||
      isDrawingConnector ||
      isDraggingConnectorHandle);
  const connectorShapeAnchors = (() => {
    if (!showConnectorAnchors) {
      return [] as ConnectorShapeAnchorMarker[];
    }

    const markers: ConnectorShapeAnchorMarker[] = [];
    objectsRef.current.forEach((entry) => {
      if (entry.type === 'connector') {
        return;
      }

      const candidates = getObjectSideAnchorCandidates(entry);
      candidates.forEach((candidate, index) => {
        markers.push({
          key: `${entry.id}-${index}`,
          objectId: entry.id,
          anchorX: candidate.anchorX,
          anchorY: candidate.anchorY,
          x: candidate.x,
          y: candidate.y,
          endpoint:
            selectedConnector &&
            selectedConnector.fromId === entry.id &&
            Math.abs((selectedConnector.fromAnchorX ?? -1) - candidate.anchorX) <= SHAPE_ANCHOR_MATCH_EPSILON &&
            Math.abs((selectedConnector.fromAnchorY ?? -1) - candidate.anchorY) <= SHAPE_ANCHOR_MATCH_EPSILON
              ? 'from'
              : selectedConnector &&
                  selectedConnector.toId === entry.id &&
                  Math.abs((selectedConnector.toAnchorX ?? -1) - candidate.anchorX) <= SHAPE_ANCHOR_MATCH_EPSILON &&
                  Math.abs((selectedConnector.toAnchorY ?? -1) - candidate.anchorY) <= SHAPE_ANCHOR_MATCH_EPSILON
                ? 'to'
                : null,
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
  const boardSharing = useBoardSharing({
    boardId,
    userId: user?.uid ?? null,
    userDisplayName: user?.displayName || user?.email || null,
    access: boardAccess,
    isSharePanelOpen,
    onSharingSaved: (nextSharing) => {
      setBoardAccess((previous) => {
        if (!previous) {
          return previous;
        }
        return {
          ...previous,
          ...nextSharing,
          isLegacyFallback: false,
        };
      });
      setCanvasNotice('Share settings saved.');
    },
  });
  useBoardRecents({
    boardId,
    userId: user?.uid ?? null,
    enabled: Boolean(canReadBoard && user?.uid),
  });
  const boardHistory = useBoardHistory({ maxEntries: BOARD_HISTORY_MAX_ENTRIES });

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

  const handleUndoAI = () => {
    handleUndoHistory();
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
    if (connectorHoverLockTimerRef.current) {
      window.clearTimeout(connectorHoverLockTimerRef.current);
      connectorHoverLockTimerRef.current = null;
    }
    connectorHoverLockRef.current = null;
    viewportRestoredRef.current = false;
    setBoardTitle('Untitled board');
    setTitleDraft('Untitled board');
    setEditingTitle(false);
    setIsSavingTitle(false);
    setTitleError(null);
    setIsSharePanelOpen(false);
    setShareState('idle');
    setBoardAccess(null);
    setBoardMissing(false);
    setIsResolvingAccess(Boolean(boardId));
    resetBoardHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (connectorHoverLockTimerRef.current) {
        window.clearTimeout(connectorHoverLockTimerRef.current);
        connectorHoverLockTimerRef.current = null;
      }
      connectorHoverLockRef.current = null;
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
      logger.info('FIRESTORE', `Loading board '${boardId}'...`, { boardId });
      try {
        const boardSnapshot = await withFirestoreTimeout(
          'Loading board access',
          getDoc(doc(db, 'boards', boardId)),
        );
        if (cancelled) {
          return;
        }

        if (!boardSnapshot.exists()) {
          logger.warn('FIRESTORE', `Board '${boardId}' not found`, { boardId });
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
              explicitMemberRole = normalizedRole;
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

        logger.info('AUTH', `Board access resolved: role='${access.effectiveRole}', canEdit=${access.canEdit}`, {
          boardId,
          effectiveRole: access.effectiveRole,
          canEdit: access.canEdit,
          canRead: access.canRead,
        });
        setBoardAccess(access);
        if (!access.canRead && shouldRedirectToSignIn(access, Boolean(user))) {
          logger.info('AUTH', 'Board requires authentication, redirecting to sign-in', { boardId });
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
          logger.warn('AUTH', `Board access denied for '${boardId}'`, { boardId, errorCode });
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
          const errMsg = err instanceof Error ? err.message : String(err);
          logger.error('FIRESTORE', `Failed to load board: ${errMsg}`, { boardId });
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
          resetBoardHistory();
          return;
        }

        const rawObjects = (snapshot.data() as { objects?: BoardObjectsRecord }).objects || {};
        const objectCount = Object.keys(rawObjects).length;
        logger.info('FIRESTORE', `Board loaded with ${objectCount} objects`, { boardId, objectCount });
        hydrateBoardObjects(rawObjects, user?.uid || 'guest');
        resetBoardHistory();
      } catch (err) {
        if (cancelled) {
          return;
        }
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.error('FIRESTORE', `Failed to load board objects: ${errMsg}`, { boardId });
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
    resetBoardHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      logger.info('SYNC', `Remote object created: ${normalized.type} '${normalized.id}' by ${payload.actorUserId || 'unknown'}`, {
        objectId: normalized.id,
        objectType: normalized.type,
        actorUserId: payload.actorUserId,
        latencyMs: Math.max(0, Date.now() - (payload._ts || 0)),
      });
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

      const latencyMs = Math.max(0, Date.now() - (payload._ts || 0));
      if (latencyMs > 200) {
        logger.warn('PERFORMANCE', `Object sync latency spike: ${latencyMs}ms for '${normalized.id}'`, {
          latencyMs,
          objectId: normalized.id,
        });
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
      logger.info('SYNC', `Remote object deleted: '${objectId}'`, {
        objectId,
        actorUserId: payload.actorUserId,
      });
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
          resetBoardHistory();
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
      logger.info('FIRESTORE', `Resyncing board from Firestore after reconnect`, { boardId });
      try {
        const snapshot = await withFirestoreTimeout(
          'Resyncing board after reconnect',
          getDoc(doc(db, 'boards', boardId)),
        );

        if (cancelled || !snapshot.exists()) {
          return;
        }

        const rawObjects = (snapshot.data() as { objects?: BoardObjectsRecord }).objects || {};
        const count = Object.keys(rawObjects).length;
        logger.info('FIRESTORE', `Board resync complete: ${count} objects loaded`, { boardId, objectCount: count });
        hydrateBoardObjects(rawObjects, user?.uid || 'guest');
        resetBoardHistory();
      } catch (err) {
        if (cancelled) {
          return;
        }
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.error('FIRESTORE', `Board resync failed: ${errMsg}`, { boardId });
        setCanvasNotice(toFirestoreUserMessage('Unable to resync board after reconnect.', err));
      }
    };

    void resyncFromFirestore();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, socketStatus, user]);

  // ── Global keyboard shortcuts for clipboard operations ──────────────
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Skip when user is typing in an input, textarea, or contenteditable
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (event.target as HTMLElement)?.isContentEditable) {
        return;
      }
      // Skip when editing text on canvas
      if (editingText) {
        return;
      }

      const mod = event.metaKey || event.ctrlKey;

      // Ctrl/Cmd + D → Duplicate
      if (mod && event.key === 'd') {
        event.preventDefault();
        handleDuplicate();
        return;
      }

      // Ctrl/Cmd + C → Copy
      if (mod && event.key === 'c') {
        event.preventDefault();
        handleCopy();
        return;
      }

      // Ctrl/Cmd + V → Paste
      if (mod && event.key === 'v') {
        event.preventDefault();
        handlePaste();
        return;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingText, canEditBoard, selectedIds]);

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
    logger.info('SYNC', `Broadcasting object create: ${object.type} '${object.id}'`, {
      objectId: object.id,
      objectType: object.type,
      boardId: liveBoardId,
    });
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

    logger.info('SYNC', `Broadcasting object delete: '${objectId}'`, { objectId, boardId: liveBoardId });
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

  function computeBoardSnapshotDiff(from: BoardObjectsRecord, to: BoardObjectsRecord): {
    createdIds: string[];
    updatedIds: string[];
    deletedIds: string[];
  } {
    const fromKeys = new Set(Object.keys(from));
    const toKeys = new Set(Object.keys(to));
    const createdIds: string[] = [];
    const updatedIds: string[] = [];
    const deletedIds: string[] = [];

    toKeys.forEach((key) => {
      const beforeObject = from[key];
      const afterObject = to[key];
      if (!beforeObject && afterObject) {
        createdIds.push(key);
        return;
      }
      if (beforeObject && afterObject && JSON.stringify(beforeObject) !== JSON.stringify(afterObject)) {
        updatedIds.push(key);
      }
    });

    fromKeys.forEach((key) => {
      if (!toKeys.has(key)) {
        deletedIds.push(key);
      }
    });

    return {
      createdIds,
      updatedIds,
      deletedIds,
    };
  }

  function captureManualHistoryBaseline(force = false): BoardObjectsRecord {
    if (!manualHistoryBaselineRef.current || force) {
      manualHistoryBaselineRef.current = serializeBoardObjects();
    }
    return manualHistoryBaselineRef.current;
  }

  function clearManualHistoryBaseline() {
    manualHistoryBaselineRef.current = null;
  }

  function commitBoardHistory(source: 'manual' | 'ai', explicitBefore?: BoardObjectsRecord) {
    const beforeState = explicitBefore || manualHistoryBaselineRef.current;
    clearManualHistoryBaseline();
    if (!beforeState) {
      return;
    }

    const afterState = serializeBoardObjects();
    boardHistory.commit({
      source,
      before: beforeState,
      after: afterState,
    });
  }

  function resetBoardHistory() {
    clearManualHistoryBaseline();
    boardHistory.reset();
  }

  function applyHistoryTransition(transition: ReturnType<typeof boardHistory.undo>, notice: string) {
    if (!transition) {
      return;
    }

    const diff = computeBoardSnapshotDiff(transition.from, transition.to);
    hydrateBoardObjects(transition.to, user?.uid || 'guest');
    setSelectedIds([]);

    const realtimeMeta: RealtimeObjectEventMeta = {
      txId: transition.entry.id,
      source: transition.entry.source === 'ai' ? 'ai' : 'user',
      actorUserId: user?.uid || 'guest',
    };

    diff.createdIds.forEach((objectId) => {
      const object = objectsRef.current.get(objectId);
      if (object) {
        emitObjectCreate(object, realtimeMeta);
      }
    });
    diff.updatedIds.forEach((objectId) => {
      const object = objectsRef.current.get(objectId);
      if (object) {
        emitObjectUpdate(object, true, realtimeMeta);
      }
    });
    diff.deletedIds.forEach((objectId) => {
      emitObjectDelete(objectId, realtimeMeta);
    });

    if (
      diff.createdIds.length > 0 ||
      diff.updatedIds.length > 0 ||
      diff.deletedIds.length > 0
    ) {
      scheduleBoardSave();
      flushBoardSave();
      setCanvasNotice(notice);
    }
  }

  const handleUndoHistory = () => {
    if (!canEditBoard) {
      setCanvasNotice('Undo is available for editors only.');
      return;
    }

    const transition = boardHistory.undo();
    applyHistoryTransition(transition, 'Undid last change.');
  };

  const handleRedoHistory = () => {
    if (!canEditBoard) {
      setCanvasNotice('Redo is available for editors only.');
      return;
    }

    const transition = boardHistory.redo();
    applyHistoryTransition(transition, 'Redid last change.');
  };

  function applyAIBoardStateCommit(nextBoardState: BoardObjectsRecord, meta: AICommitMeta) {
    const beforeState = serializeBoardObjects();
    logger.info('AI', `AI commit applied: ${meta.diff.createdIds.length} created, ${meta.diff.updatedIds.length} updated, ${meta.diff.deletedIds.length} deleted (txId: ${meta.txId})`, {
      txId: meta.txId,
      createdCount: meta.diff.createdIds.length,
      updatedCount: meta.diff.updatedIds.length,
      deletedCount: meta.diff.deletedIds.length,
    });
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
    commitBoardHistory('ai', beforeState);
  }

  async function persistBoardSave() {
    const liveBoardId = boardIdRef.current;
    if (!liveBoardId || !hasUnsavedChangesRef.current || !canEditBoard) {
      return;
    }

    if (saveInFlightRef.current) {
      logger.debug('FIRESTORE', 'Board save queued (another save in progress)', { boardId: liveBoardId });
      saveQueuedRef.current = true;
      return;
    }

    saveInFlightRef.current = true;
    const objectsRecord = serializeBoardObjects();
    const count = Object.keys(objectsRecord).length;
    const saveStartMs = Date.now();
    logger.info('FIRESTORE', `Saving board to Firestore (${count} objects)...`, { boardId: liveBoardId, objectCount: count });

    try {
      await withFirestoreTimeout(
        'Saving board changes',
        updateDoc(doc(db, 'boards', liveBoardId), {
          objects: objectsRecord,
          updatedAt: serverTimestamp(),
        }),
      );
      const saveTimeMs = Date.now() - saveStartMs;
      logger.info('FIRESTORE', `Board saved successfully (${count} objects, ${saveTimeMs}ms)`, {
        boardId: liveBoardId,
        objectCount: count,
        saveTimeMs,
      });
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
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error('FIRESTORE', `Board save failed: ${errMsg} — edits may not be persisted`, {
        boardId: liveBoardId,
        objectCount: count,
      });
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
    clearManualHistoryBaseline();
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
      const points = resolveConnectorRenderPoints(
        objectsRef.current,
        normalized,
        normalized.points || [normalized.x, normalized.y, normalized.x + normalized.width, normalized.y],
      );
      const bounds = getConnectorPathBounds(points);
      normalized = {
        ...normalized,
        x: 0,
        y: 0,
        points,
        width: bounds.width,
        height: bounds.height,
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
        (normalized.type === 'connector' && existingNode instanceof Konva.Arrow));

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
      applyConnectorNodeStyle(targetNode, normalized);
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

  function applyConnectorNodeStyle(node: Konva.Line | Konva.Arrow, entry: BoardObject) {
    const connectorType = getConnectorPathType(entry);
    const startArrow = getConnectorArrowHead(entry, 'start');
    const endArrow = getConnectorArrowHead(entry, 'end');
    const isCurved = connectorType === 'curved';

    if (node instanceof Konva.Arrow) {
      node.pointerAtBeginning(startArrow !== 'none');
      node.pointerAtEnding(endArrow !== 'none');
      node.pointerLength(Math.max(6, (entry.strokeWidth || 2) * 4));
      node.pointerWidth(Math.max(6, (entry.strokeWidth || 2) * 4));
      node.fill(entry.color || '#64748b');
    }

    node.dash(isConnectorDashed(entry) ? [10, 6] : []);
    node.bezier(isCurved);
    node.tension(isCurved ? 0.45 : 0);
  }

  function clearConnectorHoverLock() {
    if (connectorHoverLockTimerRef.current) {
      window.clearTimeout(connectorHoverLockTimerRef.current);
      connectorHoverLockTimerRef.current = null;
    }
    connectorHoverLockRef.current = null;
  }

  function updateConnectorHoverLockState(
    connector: BoardObject,
    endpoint: ConnectorEndpoint,
    worldPosition: { x: number; y: number },
    attachmentMode: 'side-center' | 'arbitrary',
  ) {
    if (getConnectorPathType(connector) !== 'straight' || attachmentMode !== 'side-center') {
      clearConnectorHoverLock();
      return;
    }

    const hoveredObjectId = findHoveredShapeId(objectsRef.current, worldPosition, connector.id);
    if (!hoveredObjectId) {
      clearConnectorHoverLock();
      return;
    }

    const existing = connectorHoverLockRef.current;
    if (
      existing &&
      existing.connectorId === connector.id &&
      existing.endpoint === endpoint &&
      existing.objectId === hoveredObjectId
    ) {
      existing.pointer = worldPosition;
      return;
    }

    clearConnectorHoverLock();
    connectorHoverLockRef.current = {
      connectorId: connector.id,
      endpoint,
      objectId: hoveredObjectId,
      startedAt: Date.now(),
      pointer: worldPosition,
    };
    connectorHoverLockTimerRef.current = window.setTimeout(() => {
      const lockState = connectorHoverLockRef.current;
      connectorHoverLockTimerRef.current = null;
      if (
        !lockState ||
        lockState.connectorId !== connector.id ||
        lockState.endpoint !== endpoint ||
        lockState.objectId !== hoveredObjectId
      ) {
        return;
      }

      updateConnectorEndpoint(
        connector.id,
        endpoint,
        lockState.pointer,
        false,
        true,
        {
          snapDuringDrag: true,
          attachmentMode: 'side-center',
          targetObjectId: lockState.objectId,
        },
      );
      connectorHoverLockRef.current = null;
    }, CONNECTOR_HOVER_LOCK_DELAY_MS);
  }

  function updateConnectorEndpoint(
    connectorId: string,
    endpoint: ConnectorEndpoint,
    worldPosition: { x: number; y: number },
    persist: boolean,
    emitRealtime = persist,
    options?: {
      detachFromCurrentAnchor?: boolean;
      snapDuringDrag?: boolean;
      attachmentMode?: 'side-center' | 'arbitrary';
      targetObjectId?: string;
    },
  ) {
    const current = objectsRef.current.get(connectorId);
    if (!current || current.type !== 'connector') {
      return;
    }
    const beforeState = persist ? captureManualHistoryBaseline() : null;

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
    const attachmentMode = options?.attachmentMode || 'side-center';
    const attachment = shouldSnap
      ? findConnectorAttachment(
          objectsRef.current,
          stageRef.current?.scaleX() || 1,
          worldPosition,
          connectorId,
          attachmentMode,
          ignoredAnchor,
          currentAnchor,
          options?.targetObjectId,
        )
      : null;

    if (endpoint === 'from') {
      if (attachment) {
        next.fromId = attachment.objectId;
        next.fromAnchorX = attachment.anchorX;
        next.fromAnchorY = attachment.anchorY;
        next.fromAttachmentMode = attachment.attachmentMode;
      } else {
        next.fromId = '';
        next.fromAnchorX = undefined;
        next.fromAnchorY = undefined;
        next.fromAttachmentMode = 'free';
      }
    } else if (attachment) {
      next.toId = attachment.objectId;
      next.toAnchorX = attachment.anchorX;
      next.toAnchorY = attachment.anchorY;
      next.toAttachmentMode = attachment.attachmentMode;
    } else {
      next.toId = '';
      next.toAnchorX = undefined;
      next.toAnchorY = undefined;
      next.toAttachmentMode = 'free';
    }

    const fallbackPoints =
      endpoint === 'from'
        ? [attachment?.x ?? worldPosition.x, attachment?.y ?? worldPosition.y, endX, endY]
        : [startX, startY, attachment?.x ?? worldPosition.x, attachment?.y ?? worldPosition.y];

    const resolvedPoints = resolveConnectorRenderPoints(objectsRef.current, next, fallbackPoints);
    const bounds = getConnectorPathBounds(resolvedPoints);

    const nextObject: BoardObject = {
      ...next,
      x: 0,
      y: 0,
      points: resolvedPoints,
      width: bounds.width,
      height: bounds.height,
    };

    objectsRef.current.set(connectorId, nextObject);
    const node = stageRef.current?.findOne(`#${connectorId}`);
    if (node instanceof Konva.Line || node instanceof Konva.Arrow) {
      node.points(resolvedPoints);
      applyConnectorNodeStyle(node, nextObject);
    }

    objectsLayerRef.current?.batchDraw();
    setBoardRevision((value) => value + 1);
    if (emitRealtime) {
      emitObjectUpdate(nextObject, persist);
    }
    if (persist) {
      aiExecutor.invalidateUndo();
      scheduleBoardSave();
      commitBoardHistory('manual', beforeState || undefined);
    }
  }

  function updateConnectorPathControl(
    connectorId: string,
    controlPoint: { x: number; y: number },
    persist: boolean,
    emitRealtime = persist,
  ) {
    const current = objectsRef.current.get(connectorId);
    if (!current || current.type !== 'connector') {
      return;
    }
    const beforeState = persist ? captureManualHistoryBaseline() : null;
    const pathType = getConnectorPathType(current);
    if (pathType !== 'bent' && pathType !== 'curved') {
      return;
    }

    const next: BoardObject = {
      ...current,
      pathControlX: controlPoint.x,
      pathControlY: controlPoint.y,
      updatedAt: persist ? new Date().toISOString() : current.updatedAt,
    };
    const resolvedPoints = resolveConnectorRenderPoints(
      objectsRef.current,
      next,
      current.points || [current.x, current.y, current.x + current.width, current.y],
    );
    const bounds = getConnectorPathBounds(resolvedPoints);
    const nextObject: BoardObject = {
      ...next,
      points: resolvedPoints,
      x: 0,
      y: 0,
      width: bounds.width,
      height: bounds.height,
    };

    objectsRef.current.set(connectorId, nextObject);
    const node = stageRef.current?.findOne(`#${connectorId}`);
    if (node instanceof Konva.Line || node instanceof Konva.Arrow) {
      node.points(resolvedPoints);
      applyConnectorNodeStyle(node, nextObject);
    }

    objectsLayerRef.current?.batchDraw();
    setBoardRevision((value) => value + 1);
    if (emitRealtime) {
      emitObjectUpdate(nextObject, persist);
    }
    if (persist) {
      aiExecutor.invalidateUndo();
      scheduleBoardSave();
      commitBoardHistory('manual', beforeState || undefined);
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
      const nextPoints = resolveConnectorRenderPoints(
        objectsRef.current,
        connector,
        connector.points || [connector.x, connector.y, connector.x + connector.width, connector.y],
      );
      const bounds = getConnectorPathBounds(nextPoints);

      const nextObject: BoardObject = {
        ...connector,
        points: nextPoints,
        x: 0,
        y: 0,
        width: bounds.width,
        height: bounds.height,
        updatedAt: persist ? new Date().toISOString() : connector.updatedAt,
      };
      objectsRef.current.set(nextObject.id, nextObject);

      const node = stageRef.current?.findOne(`#${nextObject.id}`);
      if (node instanceof Konva.Line || node instanceof Konva.Arrow) {
        node.points(nextPoints);
        applyConnectorNodeStyle(node, nextObject);
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
    const beforeState = persist ? captureManualHistoryBaseline() : null;

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
      commitBoardHistory('manual', beforeState || undefined);
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
    captureManualHistoryBaseline(true);

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
    captureManualHistoryBaseline(true);

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
    group.on('transformstart', () => {
      captureManualHistoryBaseline(true);
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
    rect.on('transformstart', () => {
      captureManualHistoryBaseline(true);
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
    circle.on('transformstart', () => {
      captureManualHistoryBaseline(true);
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
    line.on('transformstart', () => {
      captureManualHistoryBaseline(true);
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
    textNode.on('transformstart', () => {
      captureManualHistoryBaseline(true);
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
    group.on('transformstart', () => {
      captureManualHistoryBaseline(true);
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

  function createConnectorNode(object: BoardObject): Konva.Arrow {
    const points = object.points || [0, 0, object.width, object.height];
    const connector = new Konva.Arrow({
      id: object.id,
      name: 'board-object connector-object',
      points,
      stroke: object.color || '#64748b',
      fill: object.color || '#64748b',
      strokeWidth: object.strokeWidth || 2,
      hitStrokeWidth: 20,
      lineCap: 'round' as const,
      lineJoin: 'round' as const,
      listening: true,
      draggable: false,
      pointerLength: 8,
      pointerWidth: 8,
    });
    applyConnectorNodeStyle(connector, object);

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
    const beforeState = persist ? captureManualHistoryBaseline() : null;

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
      commitBoardHistory('manual', beforeState || undefined);
    }
  }

  function removeObjects(objectIds: string[], persist: boolean) {
    if (objectIds.length === 0) {
      return;
    }

    if (persist && !canEditBoard) {
      return;
    }
    const beforeState = persist ? captureManualHistoryBaseline() : null;

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
      commitBoardHistory('manual', beforeState || undefined);
    }
  }

  // ── Clipboard: Duplicate / Copy / Paste ─────────────────────────────

  function handleDuplicate() {
    if (!canEditBoard || selectedIds.length === 0) {
      return;
    }
    const originals = selectedIds
      .map((id) => objectsRef.current.get(id))
      .filter((obj): obj is BoardObject => obj !== undefined);
    if (originals.length === 0) {
      return;
    }
    const beforeState = captureManualHistoryBaseline();
    const clones = cloneObjects(originals, { dx: 20, dy: 20 });
    relinkConnectors(originals, clones);

    // Assign fresh zIndexes
    for (const clone of clones) {
      clone.zIndex = getNextZIndex();
    }

    for (const clone of clones) {
      objectsRef.current.set(clone.id, clone);
      const node = createNodeForObject(clone);
      objectsLayerRef.current?.add(node);
      emitObjectCreate(clone);
    }
    syncObjectsLayerZOrder();
    objectsLayerRef.current?.batchDraw();
    setObjectCount(objectsRef.current.size);
    setBoardRevision((value) => value + 1);
    setSelectedIds(clones.map((c) => c.id));
    aiExecutor.invalidateUndo();
    scheduleBoardSave();
    commitBoardHistory('manual', beforeState);
    logger.info('CANVAS', `Duplicated ${clones.length} object(s)`, {
      count: clones.length,
      ids: clones.map((c) => c.id),
    });
  }

  function handleCopy() {
    if (selectedIds.length === 0) {
      return;
    }
    const originals = selectedIds
      .map((id) => objectsRef.current.get(id))
      .filter((obj): obj is BoardObject => obj !== undefined);
    if (originals.length === 0) {
      return;
    }
    serializeToClipboard(originals);
    logger.info('CANVAS', `Copied ${originals.length} object(s) to clipboard`, {
      count: originals.length,
    });
  }

  function handlePaste() {
    if (!canEditBoard) {
      return;
    }
    const originals = deserializeFromClipboard();
    if (!originals || originals.length === 0) {
      return;
    }

    // Compute offset: center pasted objects at mouse cursor position,
    // or fall back to +20/+20 if pointer is not on the canvas.
    const pointer = getWorldPointerPosition();
    let dx = 20;
    let dy = 20;
    if (pointer) {
      // Find bounding box center of the copied objects
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const obj of originals) {
        minX = Math.min(minX, obj.x);
        minY = Math.min(minY, obj.y);
        maxX = Math.max(maxX, obj.x + obj.width);
        maxY = Math.max(maxY, obj.y + obj.height);
      }
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      dx = pointer.x - centerX;
      dy = pointer.y - centerY;
    }

    const beforeState = captureManualHistoryBaseline();
    const clones = cloneObjects(originals, { dx, dy });
    relinkConnectors(originals, clones);

    // Assign fresh zIndexes
    for (const clone of clones) {
      clone.zIndex = getNextZIndex();
    }

    for (const clone of clones) {
      objectsRef.current.set(clone.id, clone);
      const node = createNodeForObject(clone);
      objectsLayerRef.current?.add(node);
      emitObjectCreate(clone);
    }
    syncObjectsLayerZOrder();
    objectsLayerRef.current?.batchDraw();
    setObjectCount(objectsRef.current.size);
    setBoardRevision((value) => value + 1);
    setSelectedIds(clones.map((c) => c.id));
    aiExecutor.invalidateUndo();
    scheduleBoardSave();
    commitBoardHistory('manual', beforeState);
    logger.info('CANVAS', `Pasted ${clones.length} object(s) at cursor position`, {
      count: clones.length,
      ids: clones.map((c) => c.id),
      pastedAtCursor: !!pointer,
    });
  }

  function commitTextEdit(saveChanges: boolean) {
    if (!editingText) {
      return;
    }

    if (saveChanges && !canEditBoard) {
      setEditingText(null);
      return;
    }
    const beforeState = saveChanges ? captureManualHistoryBaseline() : null;

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
      commitBoardHistory('manual', beforeState || undefined);
    } else {
      clearManualHistoryBaseline();
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
    attachmentMode: 'side-center' | 'arbitrary' = 'side-center',
  ) {
    if (!canEditBoard) {
      return;
    }

    if (connectorDraftRef.current) {
      return;
    }
    const historyBefore = captureManualHistoryBaseline(true);

    const initialAttachment = startAttachment || findConnectorAttachment(objectsRef.current, stageRef.current?.scaleX() || 1, worldPosition, '', attachmentMode);
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
      fromAttachmentMode: initialAttachment?.attachmentMode || 'free',
      toId: '',
      toAnchorX: undefined,
      toAnchorY: undefined,
      toAttachmentMode: 'free',
      connectorType: CONNECTOR_DEFAULT_PATH_TYPE,
      strokeStyle: CONNECTOR_DEFAULT_STROKE_STYLE,
      startArrow: CONNECTOR_DEFAULT_START_ARROW,
      endArrow: CONNECTOR_DEFAULT_END_ARROW,
      labelPosition: CONNECTOR_DEFAULT_LABEL_POSITION,
      labelBackground: CONNECTOR_DEFAULT_LABEL_BACKGROUND,
      zIndex: getNextZIndex(),
      createdBy: user?.uid || 'guest',
    });

    insertObject(object, false);
    connectorDraftRef.current = {
      id: object.id,
      startX: start.x,
      startY: start.y,
      historyBefore,
    };
    setIsDrawingConnector(true);
    setSelectedIds([object.id]);
  }

  function updateConnectorDraft(
    worldPosition: { x: number; y: number },
    attachmentMode: 'side-center' | 'arbitrary',
  ) {
    const draft = connectorDraftRef.current;
    if (!draft) {
      return;
    }

    updateConnectorEndpoint(draft.id, 'to', worldPosition, false, false, {
      snapDuringDrag: false,
      attachmentMode,
    });
    const connector = objectsRef.current.get(draft.id);
    if (connector && connector.type === 'connector') {
      updateConnectorHoverLockState(connector, 'to', worldPosition, attachmentMode);
    }
  }

  function finalizeConnectorDraft() {
    const draft = connectorDraftRef.current;
    if (!draft) {
      return;
    }
    clearConnectorHoverLock();

    const current = objectsRef.current.get(draft.id);
    const node = stageRef.current?.findOne(`#${draft.id}`);
    if (!current || current.type !== 'connector' || !(node instanceof Konva.Line || node instanceof Konva.Arrow)) {
      connectorDraftRef.current = null;
      setIsDrawingConnector(false);
      clearManualHistoryBaseline();
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
    commitBoardHistory('manual', draft.historyBefore);
    objectsLayerRef.current?.batchDraw();
    setCanvasNotice(null);
  }

  function beginShapeDraft(worldPosition: { x: number; y: number }, type: 'rect' | 'circle' | 'line') {
    if (!canEditBoard) {
      return;
    }
    const historyBefore = captureManualHistoryBaseline(true);

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
      historyBefore,
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
      clearManualHistoryBaseline();
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
    commitBoardHistory('manual', draft.historyBefore);
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

  function isPerimeterAttachmentModifierPressed(event: MouseEvent | TouchEvent | undefined): boolean {
    if (!event || !('ctrlKey' in event) || !('metaKey' in event)) {
      return false;
    }
    return Boolean(event.ctrlKey || event.metaKey);
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
      const usePerimeterMode = isPerimeterAttachmentModifierPressed(event.evt);
      beginConnectorDraft(worldPosition, undefined, usePerimeterMode ? 'arbitrary' : 'side-center');
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

  function handleStageMouseMove(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const worldPosition = getWorldPointerPosition();
    if (!worldPosition) {
      return;
    }

    publishCursor(worldPosition);

    if (rectDraftRef.current) {
      updateShapeDraft(worldPosition);
    }

    if (connectorDraftRef.current) {
      const usePerimeterMode = isPerimeterAttachmentModifierPressed(event.evt);
      updateConnectorDraft(worldPosition, usePerimeterMode ? 'arbitrary' : 'side-center');
    }

    if (selectionDraftRef.current) {
      updateSelection(worldPosition);
    }
  }

  function handleStageMouseUp() {
    clearConnectorHoverLock();
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
    clearConnectorHoverLock();
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
    const endpoints = getConnectorEndpoints(points);
    const [startX, startY, endX, endY] = [
      endpoints.startX,
      endpoints.startY,
      endpoints.endX,
      endpoints.endY,
    ];
    if (endpoint === 'from') {
      return { x: startX, y: startY };
    }

    return { x: endX, y: endY };
  }

  function getSelectedConnectorPathHandle(): { x: number; y: number } | null {
    if (!selectedConnector) {
      return null;
    }
    const pathType = getConnectorPathType(selectedConnector);
    if (pathType === 'straight') {
      return null;
    }

    if (Number.isFinite(selectedConnector.pathControlX) && Number.isFinite(selectedConnector.pathControlY)) {
      return {
        x: Number(selectedConnector.pathControlX),
        y: Number(selectedConnector.pathControlY),
      };
    }

    const connectorNode = stageRef.current?.findOne(`#${selectedConnector.id}`);
    const livePoints =
      connectorNode instanceof Konva.Line || connectorNode instanceof Konva.Arrow
        ? connectorNode.points()
        : selectedConnector.points || [];

    return getPointAlongConnectorPath(livePoints, 50);
  }

  function handleConnectorHandleDragStart(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    event.cancelBubble = true;
    if (!canEditBoard) {
      return;
    }
    captureManualHistoryBaseline(true);
    clearConnectorHoverLock();
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
    const usePerimeterMode = isPerimeterAttachmentModifierPressed(event.evt);
    const attachmentMode = usePerimeterMode ? 'arbitrary' : 'side-center';
    updateConnectorEndpoint(
      selectedConnector.id,
      endpoint,
      nextPosition,
      false,
      true,
      { detachFromCurrentAnchor: true, snapDuringDrag: false, attachmentMode },
    );
    updateConnectorHoverLockState(selectedConnector, endpoint, nextPosition, attachmentMode);
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
      clearConnectorHoverLock();
      setIsDraggingConnectorHandle(false);
      return;
    }
    const connector = selectedConnector;
    setIsDraggingConnectorHandle(false);
    clearConnectorHoverLock();
    if (!connector) {
      return;
    }

    const target = event.target;
    const nextPosition = { x: target.x(), y: target.y() };
    const usePerimeterMode = isPerimeterAttachmentModifierPressed(event.evt);
    updateConnectorEndpoint(
      connector.id,
      endpoint,
      nextPosition,
      true,
      true,
      {
        detachFromCurrentAnchor: true,
        snapDuringDrag: true,
        attachmentMode: usePerimeterMode ? 'arbitrary' : 'side-center',
      },
    );
  }

  function handleConnectorPathHandleDragMove(
    event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  ) {
    event.cancelBubble = true;
    if (!canEditBoard || !selectedConnector) {
      return;
    }

    const target = event.target;
    const nextPosition = { x: target.x(), y: target.y() };
    updateConnectorPathControl(selectedConnector.id, nextPosition, false, true);
    const worldPosition = getWorldPointerPosition();
    if (worldPosition) {
      publishCursor(worldPosition);
    } else {
      publishCursor(nextPosition);
    }
  }

  function handleConnectorPathHandleDragEnd(
    event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  ) {
    event.cancelBubble = true;
    if (!canEditBoard || !selectedConnector) {
      setIsDraggingConnectorHandle(false);
      return;
    }

    const target = event.target;
    const nextPosition = { x: target.x(), y: target.y() };
    updateConnectorPathControl(selectedConnector.id, nextPosition, true, true);
    setIsDraggingConnectorHandle(false);
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

  function applyZoomFromCenter(nextScale: number) {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const oldScale = stage.scaleX() || 1;
    const clampedScale = Math.max(0.1, Math.min(5, nextScale));
    const centerScreen = {
      x: stage.width() / 2,
      y: stage.height() / 2,
    };
    const centerWorld = {
      x: (centerScreen.x - stage.x()) / oldScale,
      y: (centerScreen.y - stage.y()) / oldScale,
    };

    stage.scale({ x: clampedScale, y: clampedScale });
    stage.position({
      x: centerScreen.x - centerWorld.x * clampedScale,
      y: centerScreen.y - centerWorld.y * clampedScale,
    });
    stage.batchDraw();
    setZoomPercent(Math.round(clampedScale * 100));
    scheduleViewportSave();
    setBoardRevision((value) => value + 1);
  }

  const handleZoomIn = () => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    applyZoomFromCenter((stage.scaleX() || 1) * 1.08);
  };

  const handleZoomOut = () => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    applyZoomFromCenter((stage.scaleX() || 1) / 1.08);
  };

  const handleZoomReset = () => {
    applyZoomFromCenter(1);
  };

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

  const handleCopyShareLink = async () => {
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

  const handleSaveShareSettings = async () => {
    const saved = await boardSharing.saveSharingSettings();
    if (saved) {
      setCanvasNotice('Share settings saved.');
    }
  };

  const handleMemberRoleChange = async (membershipId: string, role: 'editor' | 'viewer') => {
    const updated = await boardSharing.updateMemberRole(membershipId, role);
    if (updated) {
      setCanvasNotice('Member role updated.');
    }
  };

  const handleMemberRemove = async (membershipId: string) => {
    const removed = await boardSharing.removeMember(membershipId);
    if (removed) {
      setCanvasNotice('Member removed.');
    }
  };

  const handleSaveToWorkspace = async () => {
    const saved = await boardSharing.saveToWorkspace();
    if (saved) {
      setCanvasNotice('Board saved to your workspace.');
    }
  };

  const updateObjectProperties = (objectId: string, patch: Partial<BoardObject>) => {
    if (!canEditBoard) {
      return;
    }

    const current = objectsRef.current.get(objectId);
    if (!current) {
      return;
    }

    if (current.type === 'connector') {
      updateConnectorProperties(objectId, patch);
      return;
    }

    const beforeState = captureManualHistoryBaseline();
    const nextCandidate = sanitizeBoardObjectForFirestore({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    const nextObject =
      normalizeLoadedObject(nextCandidate, current.createdBy) ||
      ({
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      } as BoardObject);

    objectsRef.current.set(objectId, nextObject);

    const node = stageRef.current?.findOne(`#${objectId}`);
    if (node) {
      if (nextObject.type === 'sticky' && node instanceof Konva.Group) {
        const body = node.findOne('.sticky-body') as Konva.Rect | null;
        const label = node.findOne('.sticky-label') as Konva.Text | null;
        body?.setAttrs({
          fill: nextObject.color,
        });
        label?.setAttrs({
          fill: getStickyRenderColor(nextObject.text),
          text: getStickyRenderText(nextObject.text),
          fontSize: nextObject.fontSize || 14,
        });
      } else if (
        (nextObject.type === 'rect' || nextObject.type === 'circle') &&
        node instanceof Konva.Rect
      ) {
        node.setAttrs({
          fill: nextObject.color,
          stroke: nextObject.stroke || RECT_DEFAULT_STROKE,
          strokeWidth: nextObject.strokeWidth || RECT_DEFAULT_STROKE_WIDTH,
          cornerRadius:
            nextObject.type === 'circle'
              ? Math.min(nextObject.width, nextObject.height) / 2
              : 0,
        });
      } else if (nextObject.type === 'line' && (node instanceof Konva.Line || node instanceof Konva.Arrow)) {
        node.setAttrs({
          stroke: nextObject.color,
          fill: nextObject.color,
          strokeWidth: nextObject.strokeWidth || 2,
        });
      } else if (nextObject.type === 'text' && node instanceof Konva.Text) {
        node.setAttrs({
          fill: nextObject.color,
          fontSize: nextObject.fontSize || TEXT_DEFAULT_FONT_SIZE,
          text: nextObject.text || 'Text',
        });
      } else if (nextObject.type === 'frame' && node instanceof Konva.Group) {
        const body = node.findOne('.frame-body') as Konva.Rect | null;
        const title = node.findOne('.frame-title') as Konva.Text | null;
        body?.setAttrs({
          fill: nextObject.color,
          stroke: nextObject.stroke || FRAME_DEFAULT_STROKE,
          strokeWidth: nextObject.strokeWidth || 2,
        });
        title?.setAttrs({
          text: nextObject.title || 'Frame',
        });
      }
    }

    objectsLayerRef.current?.batchDraw();
    setBoardRevision((value) => value + 1);
    aiExecutor.invalidateUndo();
    emitObjectUpdate(nextObject, true);
    scheduleBoardSave();
    commitBoardHistory('manual', beforeState);
  };

  const updateConnectorProperties = (connectorId: string, patch: Partial<BoardObject>) => {
    if (!canEditBoard) {
      return;
    }

    const current = objectsRef.current.get(connectorId);
    if (!current || current.type !== 'connector') {
      return;
    }
    const beforeState = captureManualHistoryBaseline();

    const next: BoardObject = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    if (getConnectorPathType(next) === 'straight') {
      next.pathControlX = undefined;
      next.pathControlY = undefined;
    }

    const resolvedPoints = resolveConnectorRenderPoints(
      objectsRef.current,
      next,
      current.points || [current.x, current.y, current.x + current.width, current.y],
    );
    const bounds = getConnectorPathBounds(resolvedPoints);
    const nextObject: BoardObject = {
      ...next,
      x: 0,
      y: 0,
      points: resolvedPoints,
      width: bounds.width,
      height: bounds.height,
    };

    objectsRef.current.set(connectorId, nextObject);
    const node = stageRef.current?.findOne(`#${connectorId}`);
    if (node instanceof Konva.Line || node instanceof Konva.Arrow) {
      node.setAttrs({
        points: resolvedPoints,
        stroke: nextObject.color,
        strokeWidth: nextObject.strokeWidth || 2,
      });
      applyConnectorNodeStyle(node, nextObject);
    }

    objectsLayerRef.current?.batchDraw();
    setBoardRevision((value) => value + 1);
    aiExecutor.invalidateUndo();
    emitObjectUpdate(nextObject, true);
    scheduleBoardSave();
    commitBoardHistory('manual', beforeState);
  };

  const handleBatchStyleChange = (ids: string[], patch: Partial<BoardObject>) => {
    for (const id of ids) {
      const obj = objectsRef.current.get(id);
      if (!obj) continue;
      if (obj.type === 'connector') {
        updateConnectorProperties(id, patch);
      } else if (obj.type === 'line') {
        // Lines store stroke color in `color` field, same as connectors.
        // If the patch has `stroke` (from mixed-type selection), remap to `color`.
        const linePatch = { ...patch };
        if ('stroke' in linePatch && !('color' in linePatch)) {
          linePatch.color = linePatch.stroke;
          delete linePatch.stroke;
        }
        updateObjectProperties(id, linePatch);
      } else {
        updateObjectProperties(id, patch);
      }
    }
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
      ? 'Select a tool from the bottom dock to start adding objects.'
      : 'Read-only mode. You can pan, zoom, and inspect this board.');
  const gridCellSize = Math.max(8, Math.min(72, 24 * (zoomPercent / 100)));
  const connectorFromHandle = getSelectedConnectorHandle('from');
  const connectorToHandle = getSelectedConnectorHandle('to');
  const connectorPathHandle = getSelectedConnectorPathHandle();
  const connectorLabels = Array.from(objectsRef.current.values())
    .filter((entry) => entry.type === 'connector' && typeof entry.label === 'string' && entry.label.trim().length > 0)
    .map((entry) => {
      const node = stageRef.current?.findOne(`#${entry.id}`);
      const points =
        node instanceof Konva.Line || node instanceof Konva.Arrow
          ? node.points()
          : entry.points || [entry.x, entry.y, entry.x + entry.width, entry.y];
      const point = getPointAlongConnectorPath(
        points,
        Number.isFinite(entry.labelPosition) ? Number(entry.labelPosition) : CONNECTOR_DEFAULT_LABEL_POSITION,
      );
      const text = (entry.label || '').trim();
      const bounds = estimateConnectorLabelBounds(text);
      return {
        id: entry.id,
        x: point.x,
        y: point.y,
        text,
        color: entry.color || '#111827',
        width: bounds.width,
        height: bounds.height,
      };
    });

  return (
    <main className="figma-board-root">
      <ReconnectBanner status={socketStatus} disconnectedSinceMs={disconnectedSinceMs} />
      <ShareSettingsPanel
        open={isSharePanelOpen}
        currentUserId={user?.uid ?? null}
        currentRole={boardAccess?.effectiveRole ?? 'none'}
        canManage={boardSharing.canManageSharing}
        visibility={boardSharing.draft.visibility}
        authLinkRole={boardSharing.draft.authLinkRole}
        publicLinkRole={boardSharing.draft.publicLinkRole}
        pendingPublicRole={boardSharing.pendingPublicRole}
        settingsSaving={boardSharing.settingsSaving}
        settingsError={boardSharing.settingsError}
        settingsSuccess={boardSharing.settingsSuccess}
        members={boardSharing.members}
        membersLoading={boardSharing.membersLoading}
        membersError={boardSharing.membersError}
        workspaceState={boardSharing.workspaceState}
        workspaceError={boardSharing.workspaceError}
        canSaveToWorkspace={boardSharing.canSaveToWorkspace}
        copyState={shareState}
        onClose={() => setIsSharePanelOpen(false)}
        onCopyLink={() => {
          void handleCopyShareLink();
        }}
        onVisibilityChange={boardSharing.setVisibility}
        onAuthLinkRoleChange={boardSharing.setAuthLinkRole}
        onPublicLinkRoleChange={boardSharing.setPublicLinkRole}
        onSaveSettings={() => {
          void handleSaveShareSettings();
        }}
        onMemberRoleChange={(membershipId, role) => {
          void handleMemberRoleChange(membershipId, role);
        }}
        onMemberRemove={(membershipId) => {
          void handleMemberRemove(membershipId);
        }}
        onRefreshMembers={() => {
          void boardSharing.loadMembers();
        }}
        onSaveToWorkspace={() => {
          void handleSaveToWorkspace();
        }}
      />
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
          <button
            className="chip-btn"
            onClick={handleUndoHistory}
            disabled={!canEditBoard || !boardHistory.canUndo}
          >
            Undo
          </button>
          <button
            className="chip-btn"
            onClick={handleRedoHistory}
            disabled={!canEditBoard || !boardHistory.canRedo}
          >
            Redo
          </button>
        </div>

        <div className="topbar-cluster right">
          <span className={`presence-pill ${socketStatusClass}`}>{socketStatusLabel}</span>
          <PresenceAvatars members={members} currentUserId={user?.uid ?? null} />
          <button className="secondary-btn" onClick={() => setIsSharePanelOpen(true)}>
            Share
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
              <Layer ref={objectsLayerRef} />

              <Layer ref={selectionLayerRef}>
                <Transformer ref={transformerRef} rotateEnabled />
                {connectorLabels.map((label) => (
                  <Fragment key={`${label.id}-label`}>
                    <KonvaRectShape
                      x={label.x}
                      y={label.y}
                      width={label.width}
                      height={label.height}
                      offsetX={label.width / 2}
                      offsetY={label.height / 2}
                      cornerRadius={Math.min(8, label.height / 2)}
                      fill={CONNECTOR_LABEL_BACKGROUND_FILL}
                      stroke={CONNECTOR_LABEL_BACKGROUND_STROKE}
                      strokeWidth={1}
                      listening={false}
                    />
                    <KonvaTextShape
                      x={label.x}
                      y={label.y}
                      width={label.width}
                      height={label.height}
                      offsetX={label.width / 2}
                      offsetY={label.height / 2}
                      text={label.text}
                      fontSize={CONNECTOR_LABEL_FONT_SIZE}
                      fontFamily={CONNECTOR_LABEL_FONT_FAMILY}
                      fill={label.color}
                      listening={false}
                      align="center"
                      verticalAlign="middle"
                    />
                  </Fragment>
                ))}
                {connectorShapeAnchors
                  .map((anchor) => (
                    <KonvaCircleShape
                      key={anchor.key}
                      x={anchor.x}
                      y={anchor.y}
                      radius={
                        anchor.endpoint
                          ? SHAPE_ANCHOR_RADIUS + 2
                          : canStartConnectorFromAnchor
                            ? SHAPE_ANCHOR_RADIUS + 1
                            : SHAPE_ANCHOR_RADIUS
                      }
                      fill={anchor.endpoint ? '#dbeafe' : '#ffffff'}
                      stroke={anchor.endpoint ? '#2563eb' : '#93c5fd'}
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
                            attachmentMode: 'side-center',
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
                            attachmentMode: 'side-center',
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
                {selectedConnector && connectorPathHandle ? (
                  <KonvaCircleShape
                    x={connectorPathHandle.x}
                    y={connectorPathHandle.y}
                    radius={CONNECTOR_PATH_HANDLE_RADIUS}
                    fill="#ffffff"
                    stroke="#2563eb"
                    strokeWidth={2}
                    draggable={activeTool === 'select' && canEditBoard}
                    onMouseDown={(event) => {
                      event.cancelBubble = true;
                    }}
                    onTouchStart={(event) => {
                      event.cancelBubble = true;
                    }}
                    onDragStart={handleConnectorHandleDragStart}
                    onDragMove={handleConnectorPathHandleDragMove}
                    onDragEnd={handleConnectorPathHandleDragEnd}
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
              canUndo: canEditBoard && boardHistory.canUndo,
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
          <BoardInspectorPanel
            selectedIds={selectedIds}
            selectedObject={selectedObject}
            selectedObjects={selectedObjects}
            zoomPercent={zoomPercent}
            canEditBoard={canEditBoard}
            onDeleteSelected={() => removeObjects(selectedIds, true)}
            onDeleteObject={(objectId) => removeObjects([objectId], true)}
            onUpdateObject={updateObjectProperties}
            onUpdateConnector={updateConnectorProperties}
            onBatchStyleChange={handleBatchStyleChange}
            onDuplicate={handleDuplicate}
            onCopy={handleCopy}
            onPaste={handlePaste}
          />
        </aside>
      </section>
      <BoardToolDock
        activeTool={activeTool}
        canEditBoard={canEditBoard}
        onSelectTool={(tool) => setActiveTool(tool)}
      />
      <BoardZoomChip
        zoomPercent={zoomPercent}
        onZoomOut={handleZoomOut}
        onZoomIn={handleZoomIn}
        onReset={handleZoomReset}
      />
    </main>
  );
}
