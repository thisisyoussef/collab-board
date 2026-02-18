import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore/lite';
import { useCallback, useEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import { Layer, Stage } from 'react-konva';
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
import { screenToWorld } from '../lib/utils';

export function Board() {
  const { id: boardId } = useParams<{ id: string }>();
  const { user, signOut } = useAuth();
  const { socketRef, status: socketStatus } = useSocket(boardId);
  const { members } = usePresence({ boardId, user, socketRef, socketStatus });
  const { remoteCursors, averageLatencyMs, publishCursor } = useCursors({
    boardId,
    user,
    socketRef,
    socketStatus,
  });
  const navigate = useNavigate();
  const displayName = user?.displayName || user?.email || 'Unknown';
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 960, height: 560 });
  const [boardTitle, setBoardTitle] = useState('Untitled board');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('Untitled board');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  useEffect(() => {
    if (!boardId) return;

    let cancelled = false;

    const loadBoardTitle = async () => {
      setTitleError(null);
      try {
        const snapshot = await withFirestoreTimeout(
          'Loading board',
          getDoc(doc(db, 'boards', boardId)),
        );
        if (cancelled) return;

        if (!snapshot.exists()) {
          setTitleError('Board not found.');
          return;
        }

        const nextTitle = (snapshot.data() as { title?: string }).title?.trim() || 'Untitled board';
        setBoardTitle(nextTitle);
        setTitleDraft(nextTitle);
      } catch (err) {
        if (cancelled) return;
        setTitleError(toFirestoreUserMessage('Unable to load board title.', err));
      }
    };

    void loadBoardTitle();
    return () => {
      cancelled = true;
    };
  }, [boardId]);

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

  const handleStagePointerMove = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }

    const worldPosition = screenToWorld(stage, pointer);
    publishCursor(worldPosition);
  }, [publishCursor]);

  const handleSaveTitle = async () => {
    if (!boardId) return;

    const cleaned = titleDraft.trim();
    if (!cleaned) {
      setTitleError('Board name cannot be empty.');
      return;
    }

    if (cleaned === boardTitle) {
      setEditingTitle(false);
      return;
    }

    setTitleError(null);
    setIsSavingTitle(true);
    try {
      await withFirestoreTimeout(
        'Saving board name',
        updateDoc(doc(db, 'boards', boardId), {
          title: cleaned,
          updatedAt: serverTimestamp(),
        }),
      );
      setBoardTitle(cleaned);
      setTitleDraft(cleaned);
      setEditingTitle(false);
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
          <button className="secondary-btn" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
          <button
            className="primary-btn"
            onClick={() => void signOut().then(() => navigate('/'))}
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="figma-board-workspace">
        <aside className="figma-left-rail">
          <button className="rail-btn active">↖</button>
          <button className="rail-btn">□</button>
          <button className="rail-btn">○</button>
          <button className="rail-btn">T</button>
          <button className="rail-btn">↔</button>
        </aside>

        <section className="figma-canvas-shell">
          <div className="canvas-top-info">
            <span>User: {displayName}</span>
            <span>{titleError || 'Board name editable from top-left title area'}</span>
          </div>
          <div className="canvas-grid cursor-canvas-grid" ref={canvasContainerRef}>
            <Stage
              ref={stageRef}
              width={canvasSize.width}
              height={canvasSize.height}
              className="cursor-stage"
              onMouseMove={handleStagePointerMove}
              onTouchMove={handleStagePointerMove}
            >
              <Layer listening={false} />
              <RemoteCursors cursors={remoteCursors} />
            </Stage>
            <div className="canvas-empty-message is-overlay">
              <h2>Cursor Sync Live</h2>
              <p>Move your mouse on the canvas to broadcast your cursor to collaborators in real time.</p>
            </div>
          </div>
          <MetricsOverlay averageCursorLatencyMs={averageLatencyMs} userCount={members.length} />
        </section>

        <aside className="figma-right-panel">
          <h3>Properties</h3>
          <div className="property-row">
            <span>Selection</span>
            <strong>None</strong>
          </div>
          <div className="property-row">
            <span>Zoom</span>
            <strong>100%</strong>
          </div>
          <div className="property-row">
            <span>Grid</span>
            <strong>On</strong>
          </div>
        </aside>
      </section>
    </main>
  );
}
