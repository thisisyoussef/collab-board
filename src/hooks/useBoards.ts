import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore/lite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toFirestoreUserMessage, withFirestoreTimeout } from '../lib/firestore-client';
import { db } from '../lib/firebase';

export interface BoardSummary {
  id: string;
  title: string;
  ownerId: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CreateBoardResult {
  id: string;
  committed: Promise<void>;
}

interface RawBoardData {
  title?: string;
  ownerId?: string;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

function toMillis(value: unknown): number {
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    return ((value as { toMillis: () => number }).toMillis() ?? 0);
  }
  return 0;
}

function toBoardSummary(
  id: string,
  data: RawBoardData,
  fallbackOwnerId: string,
): BoardSummary {
  return {
    id,
    title: data.title?.trim() || 'Untitled board',
    ownerId: data.ownerId || data.createdBy || fallbackOwnerId,
    createdAtMs: toMillis(data.createdAt),
    updatedAtMs: toMillis(data.updatedAt),
  };
}

function sortBoards(items: BoardSummary[]): BoardSummary[] {
  return [...items].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

async function queryBoardsByField(userId: string, field: 'ownerId' | 'createdBy') {
  try {
    const snapshot = await withFirestoreTimeout(
      'Loading boards',
      getDocs(query(collection(db, 'boards'), where(field, '==', userId))),
    );
    return { snapshot, error: null as unknown };
  } catch (err) {
    return { snapshot: null, error: err };
  }
}

export function useBoards(userId: string | undefined) {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const loadBoards = useCallback(async () => {
    if (!userId) {
      setBoards([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [ownedResult, createdResult] = await Promise.all([
        queryBoardsByField(userId, 'ownerId'),
        queryBoardsByField(userId, 'createdBy'),
      ]);

      if (ownedResult.error && createdResult.error) {
        throw createdResult.error;
      }

      const merged = new Map<string, BoardSummary>();

      if (ownedResult.snapshot) {
        ownedResult.snapshot.docs.forEach((entry) => {
          merged.set(
            entry.id,
            toBoardSummary(entry.id, entry.data() as RawBoardData, userId),
          );
        });
      }

      if (createdResult.snapshot) {
        createdResult.snapshot.docs.forEach((entry) => {
          if (!merged.has(entry.id)) {
            merged.set(
              entry.id,
              toBoardSummary(entry.id, entry.data() as RawBoardData, userId),
            );
          }
        });
      }

      setBoards(sortBoards(Array.from(merged.values())));
    } catch (err) {
      setError(toFirestoreUserMessage('Unable to load boards right now.', err));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setBoards([]);
      setError(null);
      setLoading(false);
      return;
    }

    void loadBoards();
  }, [userId, loadBoards]);

  const createBoard = useCallback(
    (title: string): CreateBoardResult => {
      if (!userId) {
        throw new Error('Not authenticated');
      }

      const boardRef = doc(collection(db, 'boards'));
      const now = Date.now();
      const cleanedTitle = title.trim() || 'Untitled board';

      setBoards((prev) =>
        sortBoards([
          {
            id: boardRef.id,
            ownerId: userId,
            title: cleanedTitle,
            createdAtMs: now,
            updatedAtMs: now,
          },
          ...prev.filter((board) => board.id !== boardRef.id),
        ]),
      );

      const committed = setDoc(boardRef, {
        ownerId: userId,
        createdBy: userId,
        title: cleanedTitle,
        objects: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const wrappedCommit = withFirestoreTimeout('Creating board', committed).catch((err) => {
        setBoards((prev) => prev.filter((board) => board.id !== boardRef.id));
        throw new Error(toFirestoreUserMessage('Failed to create board.', err));
      });

      return { id: boardRef.id, committed: wrappedCommit };
    },
    [userId],
  );

  const renameBoard = useCallback(async (boardId: string, title: string) => {
    const cleaned = title.trim();
    if (!cleaned) {
      throw new Error('Board name cannot be empty');
    }

    let previousTitle: string | null = null;
    const optimisticUpdatedAt = Date.now();

    setBoards((prev) =>
      sortBoards(
        prev.map((board) => {
          if (board.id !== boardId) return board;
          previousTitle = board.title;
          return { ...board, title: cleaned, updatedAtMs: optimisticUpdatedAt };
        }),
      ),
    );

    try {
      await withFirestoreTimeout(
        'Saving board name',
        updateDoc(doc(db, 'boards', boardId), {
          title: cleaned,
          updatedAt: serverTimestamp(),
        }),
      );
    } catch (err) {
      if (previousTitle !== null) {
        setBoards((prev) =>
          sortBoards(
            prev.map((board) =>
              board.id === boardId ? { ...board, title: previousTitle as string } : board,
            ),
          ),
        );
      }

      throw new Error(toFirestoreUserMessage('Failed to rename board.', err));
    }
  }, []);

  const removeBoard = useCallback(async (boardId: string) => {
    let removed: BoardSummary | null = null;

    setBoards((prev) => {
      const next = prev.filter((board) => {
        if (board.id !== boardId) return true;
        removed = board;
        return false;
      });
      return next;
    });

    try {
      await withFirestoreTimeout('Deleting board', deleteDoc(doc(db, 'boards', boardId)));
    } catch (err) {
      if (removed) {
        setBoards((prev) => sortBoards([removed as BoardSummary, ...prev]));
      }
      throw new Error(toFirestoreUserMessage('Failed to delete board.', err));
    }
  }, []);

  return useMemo(
    () => ({
      boards: userId ? boards : [],
      loading: userId ? loading : false,
      error: userId ? error : null,
      createBoard,
      renameBoard,
      removeBoard,
    }),
    [userId, boards, loading, error, createBoard, renameBoard, removeBoard],
  );
}
