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
  // Track whether the board has been loaded at least once.
  // Prevents saving an empty objects map before the initial load completes.
  const boardLoadedRef = useRef(false);

  // Debounced save with .flush() support for save-on-unmount.
  const debouncedSaveRef = useRef<ReturnType<typeof debounce>>(null!);

  useEffect(() => {
    // Reset loaded flag when boardId changes
    boardLoadedRef.current = false;

    const debouncedFn = debounce((objects: Record<string, BoardObject>) => {
      // Guard: never overwrite a board with empty data before initial load
      if (!boardLoadedRef.current) {
        return;
      }

      const boardRef = doc(db, 'boards', boardId);
      setDoc(boardRef, {
        objects,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch((err) => {
        console.warn('[Firestore] Save failed:', err);
      });
    }, FIRESTORE_DEBOUNCE_MS);

    debouncedSaveRef.current = debouncedFn;

    // Flush any pending save when boardId changes or component unmounts
    return () => {
      debouncedFn.flush();
    };
  }, [boardId]);

  // Load board from Firestore (source of truth on join)
  const loadBoard = useCallback(async (): Promise<BoardDocument | null> => {
    try {
      const boardRef = doc(db, 'boards', boardId);
      const snapshot = await getDoc(boardRef);
      // Mark as loaded so saves are now allowed
      boardLoadedRef.current = true;
      if (snapshot.exists()) {
        return snapshot.data() as BoardDocument;
      }
      return null;
    } catch (err) {
      console.error('[Firestore] Failed to load board:', err);
      // Still mark as loaded on error — user may create objects on an empty canvas
      boardLoadedRef.current = true;
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
      boardLoadedRef.current = true;
    },
    [boardId],
  );

  // Trigger a debounced save of the full objects map
  const triggerSave = useCallback(
    (objects: Record<string, BoardObject>) => {
      debouncedSaveRef.current?.(objects);
    },
    [],
  );

  return { loadBoard, createBoard, triggerSave };
}
