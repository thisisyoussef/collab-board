import { doc, serverTimestamp, setDoc } from 'firebase/firestore/lite';
import { useEffect, useState } from 'react';
import { toFirestoreUserMessage, withFirestoreTimeout } from '../lib/firestore-client';
import { db } from '../lib/firebase';

interface UseBoardRecentsOptions {
  boardId?: string;
  userId?: string | null;
  enabled: boolean;
}

export function useBoardRecents({ boardId, userId, enabled }: UseBoardRecentsOptions) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !boardId || !userId) {
      return;
    }

    let cancelled = false;

    const upsertRecent = async () => {
      try {
        const recentId = `${userId}_${boardId}`;
        await withFirestoreTimeout(
          'Saving board recents',
          setDoc(
            doc(db, 'boardRecents', recentId),
            {
              boardId,
              userId,
              lastOpenedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          ),
        );
        if (!cancelled) {
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(toFirestoreUserMessage('Unable to update recent board.', err));
        }
      }
    };

    void upsertRecent();

    return () => {
      cancelled = true;
    };
  }, [boardId, enabled, userId]);

  return { error };
}
