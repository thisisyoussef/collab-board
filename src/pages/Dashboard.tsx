import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBoards } from '../hooks/useBoards';

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

export function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { boards, loading, error, createBoard, renameBoard, removeBoard } = useBoards(user?.uid);

  const [newBoardName, setNewBoardName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null);

  const displayName = user?.displayName || user?.email || 'Unknown';
  const userInitial = displayName.charAt(0).toUpperCase();

  const boardCountLabel = useMemo(() => {
    if (boards.length === 1) return '1 board';
    return `${boards.length} boards`;
  }, [boards.length]);

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
      const message = err instanceof Error ? err.message : 'Failed to create board. Please try again.';
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
      const message = err instanceof Error ? err.message : 'Failed to rename board.';
      setActionError(message);
    } finally {
      setRenamingBoardId(null);
    }
  };

  const handleDeleteBoard = async (boardId: string, title: string) => {
    const confirmed = window.confirm(`Delete "${title}"? This action cannot be undone.`);
    if (!confirmed) return;

    setActionError(null);
    try {
      await removeBoard(boardId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete board. Please try again.';
      setActionError(message);
    }
  };

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
          <h2>Your Workspace</h2>
          <p className="landing-muted">Create and manage all your boards.</p>
          <div className="sidebar-list">
            <button className="sidebar-item active">All boards</button>
            <button className="sidebar-item" disabled>
              Shared with me (soon)
            </button>
            <button className="sidebar-item" disabled>
              Templates (soon)
            </button>
          </div>
        </aside>

        <section className="dashboard-main">
          <div className="dashboard-main-head">
            <div>
              <h1>Boards</h1>
              <p className="landing-muted">{boardCountLabel}</p>
            </div>
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
                placeholder="New board name"
                className="board-input"
              />
              <button className="primary-btn" type="submit" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Board'}
              </button>
            </form>
          </div>

          {(error || actionError) && <p className="auth-error">{error || actionError}</p>}

          {loading ? (
            <div className="dashboard-empty">Loading your boards...</div>
          ) : boards.length === 0 ? (
            <div className="dashboard-empty">No boards yet. Create your first board above.</div>
          ) : (
            <div className="board-list">
              {boards.map((board) => {
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
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
