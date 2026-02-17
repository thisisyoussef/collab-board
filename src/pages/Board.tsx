import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Canvas } from '../components/Canvas';
import { ShareButton } from '../components/ShareButton';
import { useAuth } from '../hooks/useAuth';
import { initAblyClient } from '../lib/ably';
import { USER_COLORS } from '../constants';

/**
 * Board page — wraps Canvas with auth guard and boardId from route.
 * Initializes Ably BEFORE rendering Canvas to prevent race conditions
 * where hooks subscribe on a stale connection.
 */
export function Board() {
  const { id: boardId } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [ablyReady, setAblyReady] = useState(false);

  // Initialize Ably with auth'd clientId BEFORE Canvas mounts.
  useEffect(() => {
    if (user) {
      initAblyClient(user.uid);
      setAblyReady(true);
    }
  }, [user]);

  // Stable user color derived from UID
  const userColor = useMemo(() => {
    if (!user) return USER_COLORS[0];
    let hash = 0;
    for (let i = 0; i < user.uid.length; i++) {
      hash = (hash * 31 + user.uid.charCodeAt(i)) | 0;
    }
    return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
  }, [user]);

  const userName = user?.displayName || user?.email?.split('@')[0] || 'Anonymous';

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  if (loading || !ablyReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        Loading...
      </div>
    );
  }

  if (!user || !boardId) {
    return null;
  }

  return (
    <>
      {/* Back to dashboard button */}
      <button
        onClick={() => navigate('/dashboard')}
        title="Back to Dashboard"
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          background: '#fff',
          border: 'none',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
          color: '#333',
        }}
      >
        ← Boards
      </button>

      <Canvas
        boardId={boardId}
        userId={user.uid}
        userName={userName}
        userColor={userColor}
      />
      <ShareButton />
    </>
  );
}
