import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore/lite';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { toFirestoreUserMessage, withFirestoreTimeout } from '../lib/firestore-client';
import { db } from '../lib/firebase';

export function Board() {
  const { id: boardId } = useParams<{ id: string }>();
  const { user, signOut } = useAuth();
  const { status: socketStatus } = useSocket(boardId);
  const navigate = useNavigate();
  const displayName = user?.displayName || user?.email || 'Unknown';
  const userInitial = displayName.charAt(0).toUpperCase();
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
    return <div className="centered-screen">Missing board ID.</div>;
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
          <span className="avatar-badge">{userInitial}</span>
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
          <div className="canvas-grid">
            <div className="canvas-empty-message">
              <h2>Board Shell Ready</h2>
              <p>Figma-like interface scaffold is in place. Realtime layers and canvas tools come next.</p>
            </div>
          </div>
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
