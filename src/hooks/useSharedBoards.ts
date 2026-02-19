import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore/lite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toFirestoreUserMessage, withFirestoreTimeout } from '../lib/firestore-client';
import { db } from '../lib/firebase';
import type { BoardRole, SharedBoardDashboardEntry } from '../types/sharing';

interface RawBoardData {
  title?: unknown;
  ownerId?: unknown;
  createdBy?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface ExplicitMemberRecord {
  boardId: string;
  role: Exclude<BoardRole, 'none'>;
}

interface RecentBoardRecord {
  boardId: string;
  lastOpenedAtMs: number;
}

function toMillis(value: unknown): number {
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function normalizeRole(value: unknown): Exclude<BoardRole, 'none'> | null {
  if (value === 'owner' || value === 'editor' || value === 'viewer') {
    return value;
  }
  return null;
}

function roleRank(role: Exclude<BoardRole, 'none'>): number {
  if (role === 'owner') {
    return 3;
  }
  return role === 'editor' ? 2 : 1;
}

function parseExplicitMembers(rawDocs: Array<{ data: () => Record<string, unknown> }>): ExplicitMemberRecord[] {
  const byBoardId = new Map<string, ExplicitMemberRecord>();

  rawDocs.forEach((entry) => {
    const data = entry.data();
    const boardId = typeof data.boardId === 'string' ? data.boardId.trim() : '';
    const role = normalizeRole(data.role);
    if (!boardId || !role) {
      return;
    }

    const existing = byBoardId.get(boardId);
    if (!existing || roleRank(role) > roleRank(existing.role)) {
      byBoardId.set(boardId, { boardId, role });
    }
  });

  return Array.from(byBoardId.values());
}

function parseRecentBoards(rawDocs: Array<{ data: () => Record<string, unknown> }>): RecentBoardRecord[] {
  const byBoardId = new Map<string, RecentBoardRecord>();

  rawDocs.forEach((entry) => {
    const data = entry.data();
    const boardId = typeof data.boardId === 'string' ? data.boardId.trim() : '';
    if (!boardId) {
      return;
    }

    const lastOpenedAtMs = toMillis(data.lastOpenedAt);
    const existing = byBoardId.get(boardId);
    if (!existing || lastOpenedAtMs > existing.lastOpenedAtMs) {
      byBoardId.set(boardId, { boardId, lastOpenedAtMs });
    }
  });

  return Array.from(byBoardId.values());
}

async function querySharedCollection(
  collectionName: 'boardMembers' | 'boardRecents',
  userId: string,
) {
  try {
    const snapshot = await withFirestoreTimeout(
      `Loading ${collectionName}`,
      getDocs(query(collection(db, collectionName), where('userId', '==', userId))),
    );
    return { snapshot, error: null as unknown };
  } catch (error) {
    return { snapshot: null, error };
  }
}

async function loadSharedBoardSummary(boardId: string): Promise<SharedBoardDashboardEntry | null> {
  try {
    const snapshot = await withFirestoreTimeout(
      'Loading shared board',
      getDoc(doc(db, 'boards', boardId)),
    );
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data() as RawBoardData;
    return {
      id: boardId,
      title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'Untitled board',
      ownerId:
        typeof data.ownerId === 'string' && data.ownerId.trim()
          ? data.ownerId
          : typeof data.createdBy === 'string' && data.createdBy.trim()
            ? data.createdBy
            : 'unknown',
      createdAtMs: toMillis(data.createdAt),
      updatedAtMs: toMillis(data.updatedAt),
      source: 'explicit',
    };
  } catch {
    return null;
  }
}

export function useSharedBoards(userId: string | undefined) {
  const [explicitBoards, setExplicitBoards] = useState<SharedBoardDashboardEntry[]>([]);
  const [recentBoards, setRecentBoards] = useState<SharedBoardDashboardEntry[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const loadSharedBoards = useCallback(async () => {
    if (!userId) {
      setExplicitBoards([]);
      setRecentBoards([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [membersResult, recentsResult] = await Promise.all([
        querySharedCollection('boardMembers', userId),
        querySharedCollection('boardRecents', userId),
      ]);

      if (membersResult.error && recentsResult.error) {
        throw membersResult.error;
      }

      const explicitMembers = membersResult.snapshot
        ? parseExplicitMembers(
            membersResult.snapshot.docs as Array<{ data: () => Record<string, unknown> }>,
          )
        : [];
      const recentRecords = recentsResult.snapshot
        ? parseRecentBoards(
            recentsResult.snapshot.docs as Array<{ data: () => Record<string, unknown> }>,
          )
        : [];

      const boardIds = Array.from(
        new Set<string>([
          ...explicitMembers.map((entry) => entry.boardId),
          ...recentRecords.map((entry) => entry.boardId),
        ]),
      );

      const summaries = await Promise.all(boardIds.map((boardId) => loadSharedBoardSummary(boardId)));
      const summaryByBoardId = new Map(
        summaries
          .filter((entry): entry is SharedBoardDashboardEntry => Boolean(entry))
          .map((entry) => [entry.id, entry]),
      );

      const nextExplicitBoards: SharedBoardDashboardEntry[] = [];
      explicitMembers.forEach((member) => {
        const summary = summaryByBoardId.get(member.boardId);
        if (!summary) {
          return;
        }

        nextExplicitBoards.push({
          ...summary,
          source: 'explicit',
          role: member.role,
        });
      });
      nextExplicitBoards.sort((a, b) => {
        if (b.updatedAtMs !== a.updatedAtMs) {
          return b.updatedAtMs - a.updatedAtMs;
        }
        return a.title.localeCompare(b.title);
      });

      const explicitBoardIds = new Set(nextExplicitBoards.map((entry) => entry.id));
      const nextRecentBoards: SharedBoardDashboardEntry[] = [];
      recentRecords.forEach((recent) => {
        if (explicitBoardIds.has(recent.boardId)) {
          return;
        }

        const summary = summaryByBoardId.get(recent.boardId);
        if (!summary) {
          return;
        }

        nextRecentBoards.push({
          ...summary,
          source: 'recent',
          lastOpenedAtMs: recent.lastOpenedAtMs,
        });
      });
      nextRecentBoards.sort((a, b) => {
        const aLastOpened = a.lastOpenedAtMs || 0;
        const bLastOpened = b.lastOpenedAtMs || 0;
        if (bLastOpened !== aLastOpened) {
          return bLastOpened - aLastOpened;
        }
        if (b.updatedAtMs !== a.updatedAtMs) {
          return b.updatedAtMs - a.updatedAtMs;
        }
        return a.title.localeCompare(b.title);
      });

      setExplicitBoards(nextExplicitBoards);
      setRecentBoards(nextRecentBoards);
    } catch (err) {
      setExplicitBoards([]);
      setRecentBoards([]);
      setError(toFirestoreUserMessage('Unable to load shared boards right now.', err));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setExplicitBoards([]);
      setRecentBoards([]);
      setLoading(false);
      setError(null);
      return;
    }

    void loadSharedBoards();
  }, [loadSharedBoards, userId]);

  return useMemo(
    () => ({
      explicitBoards: userId ? explicitBoards : [],
      recentBoards: userId ? recentBoards : [],
      loading: userId ? loading : false,
      error: userId ? error : null,
      reload: loadSharedBoards,
    }),
    [error, explicitBoards, loadSharedBoards, loading, recentBoards, userId],
  );
}
