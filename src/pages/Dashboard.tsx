import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { generateBoardId } from '../lib/utils';

interface BoardSummary {
  id: string;
  title: string;
}

export function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(true);

  // Redirect to landing if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  // Load user's boards
  useEffect(() => {
    if (!user) return;
    const loadBoards = async () => {
      try {
        const q = query(collection(db, 'boards'), where('ownerId', '==', user.uid));
        const snapshot = await getDocs(q);
        const boardList: BoardSummary[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          title: (doc.data().title as string) || 'Untitled Board',
        }));
        setBoards(boardList);
      } catch (err) {
        console.error('Failed to load boards:', err);
      }
      setLoadingBoards(false);
    };
    loadBoards();
  }, [user]);

  const handleCreateBoard = useCallback(() => {
    if (!user) return;
    const boardId = generateBoardId();
    // Navigate immediately for snappy UX — board page will create doc if missing
    navigate(`/board/${boardId}`);
    // Fire-and-forget Firestore write
    setDoc(doc(db, 'boards', boardId), {
      ownerId: user.uid,
      title: 'Untitled Board',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      objects: {},
    }).catch((err) => console.warn('Board creation write failed:', err));
  }, [user, navigate]);

  if (authLoading || !user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>My Boards</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleCreateBoard}
            style={{
              padding: '10px 20px',
              background: '#4ECDC4',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            + New Board
          </button>
          <button
            onClick={signOut}
            style={{
              padding: '10px 20px',
              background: '#eee',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {loadingBoards ? (
        <p>Loading boards...</p>
      ) : boards.length === 0 ? (
        <p style={{ color: '#999' }}>No boards yet. Create your first board!</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {boards.map((board) => (
            <div
              key={board.id}
              onClick={() => navigate(`/board/${board.id}`)}
              style={{
                padding: '1.5rem',
                background: '#fff',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                transition: 'transform 0.1s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <h3 style={{ margin: '0 0 0.5rem' }}>{board.title}</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#999' }}>
                {board.id.slice(0, 8)}...
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
