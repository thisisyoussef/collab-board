import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Canvas } from '../components/Canvas';
import { ShareButton } from '../components/ShareButton';
import { useAuth } from '../hooks/useAuth';
import { initAblyClient } from '../lib/ably';
import { USER_COLORS } from '../constants';

/**
 * Board page — wraps Canvas with auth guard and boardId from route.
 * Per collabboard-architecture rule: /board/:id route.
 */
export function Board() {
  const { id: boardId } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Initialize Ably with auth'd clientId
  useEffect(() => {
    if (user) {
      initAblyClient(user.uid);
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

  if (loading) {
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
