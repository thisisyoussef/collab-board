import { useCallback, useRef, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { debounce } from '../lib/utils';
import { FIRESTORE_DEBOUNCE_MS } from '../constants';
import type { BoardObject, BoardDocument } from '../types';

/**
 * Firestore persistence hook — load, create, and debounced save.
 * Per ably-firestore-sync skill: debounced writes every 3s, never per-event.
 * Per realtime-sync-patterns rule: Firestore = source of truth on join.
 */
export function useFirestoreBoard(boardId: string) {
  // Rebuild the debounced save whenever boardId changes
  const debouncedSaveRef = useRef<(objects: Record<string, BoardObject>) => void>(() => {});

  useEffect(() => {
    debouncedSaveRef.current = debounce((objects: Record<string, BoardObject>) => {
      const boardRef = doc(db, 'boards', boardId);
      setDoc(boardRef, {
        objects,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch((err) => {
        console.warn('[Firestore] Save failed:', err);
      });
    }, FIRESTORE_DEBOUNCE_MS);
  }, [boardId]);

  // Load board from Firestore (source of truth on join)
  const loadBoard = useCallback(async (): Promise<BoardDocument | null> => {
    try {
      const boardRef = doc(db, 'boards', boardId);
      const snapshot = await getDoc(boardRef);
      if (snapshot.exists()) {
        return snapshot.data() as BoardDocument;
      }
      return null;
    } catch (err) {
      console.error('[Firestore] Failed to load board:', err);
      return null;
    }
  }, [boardId]);

  // Create a new board document
  const createBoard = useCallback(
    async (ownerId: string, title: string) => {
      const boardRef = doc(db, 'boards', boardId);
      await setDoc(boardRef, {
        ownerId,
        title,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        objects: {},
      } satisfies Omit<BoardDocument, 'createdAt' | 'updatedAt'> & {
        createdAt: ReturnType<typeof serverTimestamp>;
        updatedAt: ReturnType<typeof serverTimestamp>;
      });
    },
    [boardId],
  );

  // Trigger a debounced save of the full objects map
  const triggerSave = useCallback(
    (objects: Record<string, BoardObject>) => {
      debouncedSaveRef.current(objects);
    },
    [],
  );

  return { loadBoard, createBoard, triggerSave };
}
