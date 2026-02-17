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
  // Canvas hooks depend on a live Ably connection — rendering Canvas
  // before this completes causes subscriptions on a dead client.
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
