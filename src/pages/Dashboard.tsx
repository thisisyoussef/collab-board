// Dashboard page — the user's board management hub at /dashboard (auth required).
// Shows two tabs: "My Boards" (owned) and "Shared with me" (via boardMembers/boardRecents).
// Supports create, rename, delete operations via useBoards hook.
// Board cards link to /board/:id for the canvas editor.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBoards } from '../hooks/useBoards';
import { useSharedBoards } from '../hooks/useSharedBoards';
import type { SharedBoardDashboardEntry } from '../types/sharing';
import './Dashboard.css';

type DashboardView = 'owned' | 'shared';

function formatDate(ms: number): string {
  if (!ms) return 'Just now';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(ms);
}

function boardCountLabel(count: number): string {
  if (count === 1) {
    return '1 case';
  }
  return `${count} cases`;
}

interface SharedSectionProps {
  title: string;
  emptyText: string;
  boards: SharedBoardDashboardEntry[];
  onOpenBoard: (boardId: string) => void;
}

function SharedBoardsSection({ title, emptyText, boards, onOpenBoard }: SharedSectionProps) {
  return (
    <section className="shared-section">
      <header className="shared-section-head">
        <h2>{title}</h2>
      </header>

      {boards.length === 0 ? (
        <div className="shared-section-empty">{emptyText}</div>
      ) : (
        <div className="board-list">
          {boards.map((board) => (
            <article key={`${board.source}-${board.id}`} className="board-card">
              <div className="board-card-main">
                <h3>{board.title}</h3>
                <p>
                  Updated {formatDate(board.updatedAtMs)}
                  {board.source === 'recent' && board.lastOpenedAtMs
                    ? ` • Opened ${formatDate(board.lastOpenedAtMs)}`
                    : ''}
                </p>
              </div>

              <div className="board-card-actions">
                <button
                  className="secondary-btn"
                  aria-label={`Open shared board ${board.title}`}
                  onClick={() => onOpenBoard(board.id)}
                >
                  Open
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { boards, loading, error, createBoard, renameBoard, removeBoard } = useBoards(user?.uid);
  const { explicitBoards, recentBoards, loading: sharedLoading, error: sharedError } = useSharedBoards(
    user?.uid,
  );

  const [activeView, setActiveView] = useState<DashboardView>('owned');
  const [newBoardName, setNewBoardName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null);

  const displayName = user?.displayName || user?.email || 'Unknown';
  const userInitial = displayName.charAt(0).toUpperCase();
  const sharedCount = explicitBoards.length + recentBoards.length;
  const heading = activeView === 'owned' ? 'Cases' : 'Shared with me';
  const countLabel = activeView === 'owned' ? boardCountLabel(boards.length) : boardCountLabel(sharedCount);
  const visibleError = activeView === 'owned' ? error || actionError : sharedError;
  const coverageLabel = activeView === 'owned' ? 'Active caseload' : 'Shared cases';
  const coverageSummary =
    activeView === 'owned'
      ? `Tracking ${countLabel} in your direct caseload.`
      : `Tracking ${countLabel} shared via team access and recent links.`;

  const openBoard = (boardId: string) => {
    navigate(`/board/${boardId}`);
  };

  const handleCreateBoard = async () => {
    if (isCreating) return;
    setActionError(null);
    setIsCreating(true);
    try {
      const { id: boardId, committed } = createBoard(newBoardName);
      await committed;
      setNewBoardName('');
      openBoard(boardId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create case board. Please try again.';
      setActionError(message);
      return;
    } finally {
      setIsCreating(false);
    }
  };

  const handleRenameBoard = async (boardId: string) => {
    if (renamingBoardId === boardId) return;
    setActionError(null);
    setRenamingBoardId(boardId);
    try {
      await renameBoard(boardId, editingName);
      setEditingBoardId(null);
      setEditingName('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to rename case.';
      setActionError(message);
    } finally {
      setRenamingBoardId(null);
    }
  };

  const handleDeleteBoard = async (boardId: string, title: string) => {
    const confirmed = window.confirm(`Delete case "${title}"? This action cannot be undone.`);
    if (!confirmed) return;

    setActionError(null);
    try {
      await removeBoard(boardId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete case. Please try again.';
      setActionError(message);
    }
  };

  const ownedBoardCards = boards.map((board) => {
    const isEditing = editingBoardId === board.id;

    return (
      <article key={board.id} className="board-card">
        <div className="board-card-main">
          {isEditing ? (
            <input
              className="board-input"
              value={editingName}
              onChange={(event) => setEditingName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleRenameBoard(board.id);
                }
                if (event.key === 'Escape') {
                  setEditingBoardId(null);
                  setEditingName('');
                }
              }}
              autoFocus
            />
          ) : (
            <h3>{board.title}</h3>
          )}
          <p>Updated {formatDate(board.updatedAtMs || board.createdAtMs)}</p>
        </div>

        <div className="board-card-actions">
          <button className="secondary-btn" onClick={() => openBoard(board.id)}>
            Open
          </button>

          {isEditing ? (
            <>
              <button
                className="primary-btn"
                disabled={renamingBoardId === board.id}
                onClick={() => void handleRenameBoard(board.id)}
              >
                {renamingBoardId === board.id ? 'Saving...' : 'Save'}
              </button>
              <button
                className="secondary-btn"
                onClick={() => {
                  setEditingBoardId(null);
                  setEditingName('');
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="secondary-btn"
              onClick={() => {
                setEditingBoardId(board.id);
                setEditingName(board.title);
              }}
            >
              Rename
            </button>
          )}

          <button
            className="danger-btn"
            onClick={() => void handleDeleteBoard(board.id, board.title)}
          >
            Delete
          </button>
        </div>
      </article>
    );
  });

  return (
    <main className="dashboard-root">
      <header className="dashboard-topbar">
        <div className="dashboard-brand">
          <span className="logo-dot" />
          <span>CollabBoard</span>
        </div>

        <div className="dashboard-actions">
          <span className="dashboard-user">{displayName}</span>
          <span className="avatar-badge">{userInitial}</span>
          <button className="secondary-btn" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <section className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <p className="dashboard-sidebar-kicker">Case Management</p>
          <h2>Caseload overview</h2>
          <p className="landing-muted">Create and manage your litigation boards.</p>
          <div className="sidebar-list dashboard-sidebar-nav">
            <button
              className={`sidebar-item ${activeView === 'owned' ? 'active' : ''}`}
              onClick={() => setActiveView('owned')}
            >
              All cases
            </button>
            <button
              className={`sidebar-item ${activeView === 'shared' ? 'active' : ''}`}
              onClick={() => setActiveView('shared')}
            >
              Shared with me
            </button>
            <button className="sidebar-item" disabled>
              Case templates (soon)
            </button>
          </div>
          <div className="dashboard-sidebar-metrics">
            <article className="dashboard-metric-card">
              <span className="dashboard-metric-label">My cases</span>
              <strong>{boards.length}</strong>
            </article>
            <article className="dashboard-metric-card">
              <span className="dashboard-metric-label">Shared cases</span>
              <strong>{sharedCount}</strong>
            </article>
          </div>
        </aside>

        <section className="dashboard-main">
          <div className="dashboard-main-head">
            <div className="dashboard-main-title">
              <p className="dashboard-main-kicker">Case command center</p>
              <h1>{heading}</h1>
              <p className="landing-muted">{countLabel}</p>
            </div>
            {activeView === 'owned' ? (
              <form
                className="create-board-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCreateBoard();
                }}
              >
                <input
                  value={newBoardName}
                  onChange={(event) => setNewBoardName(event.target.value)}
                  placeholder="New case name (e.g., Smith v. Acme)"
                  className="board-input"
                />
                <button className="primary-btn" type="submit" disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create Case'}
                </button>
              </form>
            ) : null}
          </div>
          <div className="dashboard-context-cards">
            <article className="dashboard-context-card">
              <p className="dashboard-context-kicker">Focus</p>
              <h2>{activeView === 'owned' ? 'Build and refine your case strategy' : 'Review co-counsel case boards'}</h2>
              <p>{activeView === 'owned' ? 'Map claims, evidence, and witnesses. Score argument strength with AI.' : 'Open shared case boards and track the latest updates from your team.'}</p>
            </article>
            <article className="dashboard-context-card">
              <p className="dashboard-context-kicker">Coverage</p>
              <h2>{coverageLabel}</h2>
              <p>{coverageSummary}</p>
            </article>
          </div>

          {visibleError ? <p className="auth-error">{visibleError}</p> : null}

          {activeView === 'owned' ? (
            loading ? (
              <div className="dashboard-empty">Loading your cases...</div>
            ) : boards.length === 0 ? (
              <div className="dashboard-empty">No cases yet. Create your first litigation board above.</div>
            ) : (
              <div className="board-list">{ownedBoardCards}</div>
            )
          ) : sharedLoading ? (
            <div className="dashboard-empty">Loading shared cases...</div>
          ) : explicitBoards.length === 0 && recentBoards.length === 0 ? (
            <div className="dashboard-empty">
              No shared cases yet. Open a shared case link or ask lead counsel to add you.
            </div>
          ) : (
            <div className="shared-boards-list">
              <SharedBoardsSection
                title="Shared by co-counsel"
                boards={explicitBoards}
                emptyText="No directly shared cases yet."
                onOpenBoard={openBoard}
              />
              <SharedBoardsSection
                title="Recent case links"
                boards={recentBoards}
                emptyText="No recent case links yet."
                onOpenBoard={openBoard}
              />
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
