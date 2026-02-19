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
import { logger } from '../lib/logger';

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
    // We query both fields during migration from createdBy -> ownerId.
    // If one path fails, the caller can still fall back to the other result.
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

    logger.info('FIRESTORE', 'Loading boards from Firestore', { userId });

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

      const boardList = sortBoards(Array.from(merged.values()));
      logger.info('FIRESTORE', `Loaded ${boardList.length} board(s) from Firestore`, {
        boardCount: boardList.length,
        userId,
      });
      setBoards(boardList);
    } catch (err) {
      const msg = toFirestoreUserMessage('Unable to load boards right now.', err);
      logger.error('FIRESTORE', `Failed to load boards: ${msg}`, { userId });
      setError(msg);
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

      logger.info('FIRESTORE', `Creating board '${cleanedTitle}'`, { boardId: boardRef.id, userId });

      // Optimistic insert keeps dashboard creation instant while write commits.
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
        schemaVersion: 2,
        sharing: {
          visibility: 'private',
          authLinkRole: 'editor',
          publicLinkRole: 'viewer',
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const wrappedCommit = withFirestoreTimeout('Creating board', committed)
        .then(() => {
          logger.info('FIRESTORE', `Board '${cleanedTitle}' created successfully`, { boardId: boardRef.id });
        })
        .catch((err) => {
          logger.error('FIRESTORE', `Failed to create board '${cleanedTitle}': ${err instanceof Error ? err.message : 'Unknown error'}`, { boardId: boardRef.id });
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

    const previousBoard = boards.find((board) => board.id === boardId) || null;
    const optimisticUpdatedAt = Date.now();

    logger.info('FIRESTORE', `Renaming board to '${cleaned}'`, { boardId, previousTitle: previousBoard?.title });

    setBoards((prev) =>
      sortBoards(
        prev.map((board) =>
          board.id === boardId
            ? { ...board, title: cleaned, updatedAtMs: optimisticUpdatedAt }
            : board,
        ),
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
      logger.error('FIRESTORE', `Failed to rename board: ${err instanceof Error ? err.message : 'Unknown error'}`, { boardId });
      if (previousBoard) {
        setBoards((prev) =>
          sortBoards(
            prev.map((board) =>
              board.id === boardId
                ? {
                    ...board,
                    title: previousBoard.title,
                    updatedAtMs: previousBoard.updatedAtMs,
                  }
                : board,
            ),
          ),
        );
      }

      throw new Error(toFirestoreUserMessage('Failed to rename board.', err));
    }
  }, [boards]);

  const removeBoard = useCallback(async (boardId: string) => {
    const removedBoard = boards.find((board) => board.id === boardId) || null;

    logger.info('FIRESTORE', `Deleting board '${removedBoard?.title ?? boardId}'`, { boardId });

    // Optimistic delete keeps UI responsive; failed deletes restore the record.
    setBoards((prev) => prev.filter((board) => board.id !== boardId));

    try {
      await withFirestoreTimeout('Deleting board', deleteDoc(doc(db, 'boards', boardId)));
      logger.info('FIRESTORE', `Board '${removedBoard?.title ?? boardId}' deleted successfully`, { boardId });
    } catch (err) {
      logger.error('FIRESTORE', `Failed to delete board: ${err instanceof Error ? err.message : 'Unknown error'}`, { boardId });
      if (removedBoard) {
        setBoards((prev) => sortBoards([removedBoard, ...prev]));
      }
      throw new Error(toFirestoreUserMessage('Failed to delete board.', err));
    }
  }, [boards]);

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
