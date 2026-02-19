import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSharedBoards } from './useSharedBoards';

const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();

const mockWithFirestoreTimeout = vi.fn((_: string, promise: Promise<unknown>) => promise);
const mockToFirestoreUserMessage = vi.fn((fallback: string) => fallback);

vi.mock('firebase/firestore/lite', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
}));

vi.mock('../lib/firebase', () => ({
  db: { app: 'test-db' },
}));

vi.mock('../lib/firestore-client', () => ({
  withFirestoreTimeout: (...args: [string, Promise<unknown>]) => mockWithFirestoreTimeout(...args),
  toFirestoreUserMessage: (...args: [string, unknown]) => mockToFirestoreUserMessage(...args),
}));

function timestamp(ms: number) {
  return {
    toMillis: () => ms,
  };
}

function snapshotFromDocs(
  docs: Array<{
    id: string;
    data: () => Record<string, unknown>;
  }>,
) {
  return { docs };
}

describe('useSharedBoards', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCollection.mockImplementation((_db: unknown, name: string) => ({ name }));
    mockWhere.mockImplementation((field: string, op: string, value: string) => ({ field, op, value }));
    mockQuery.mockImplementation((collectionRef: unknown, whereClause: unknown) => ({
      collectionRef,
      whereClause,
    }));
    mockDoc.mockImplementation((_db: unknown, collectionName: string, docId: string) => ({
      id: docId,
      path: `${collectionName}/${docId}`,
    }));
    mockWithFirestoreTimeout.mockImplementation((_: string, promise: Promise<unknown>) => promise);
    mockToFirestoreUserMessage.mockImplementation((fallback: string) => fallback);
  });

  it('merges explicit and recent shared boards with dedupe precedence and sorting', async () => {
    const memberSnapshot = snapshotFromDocs([
      {
        id: 'board-a_user-1',
        data: () => ({ boardId: 'board-a', userId: 'user-1', role: 'viewer' }),
      },
      {
        id: 'board-c_user-1',
        data: () => ({ boardId: 'board-c', userId: 'user-1', role: 'editor' }),
      },
    ]);

    const recentSnapshot = snapshotFromDocs([
      {
        id: 'user-1_board-c',
        data: () => ({ boardId: 'board-c', userId: 'user-1', lastOpenedAt: timestamp(6000) }),
      },
      {
        id: 'user-1_board-b',
        data: () => ({ boardId: 'board-b', userId: 'user-1', lastOpenedAt: timestamp(7000) }),
      },
    ]);

    mockGetDocs.mockImplementation((queryRef: { collectionRef: { name: string } }) => {
      if (queryRef.collectionRef.name === 'boardMembers') {
        return Promise.resolve(memberSnapshot);
      }
      return Promise.resolve(recentSnapshot);
    });

    mockGetDoc.mockImplementation((ref: { path: string }) => {
      const boardId = ref.path.split('/')[1];
      if (boardId === 'board-a') {
        return Promise.resolve({
          exists: () => true,
          data: () => ({
            title: 'Board A',
            ownerId: 'owner-a',
            createdAt: timestamp(1000),
            updatedAt: timestamp(5000),
          }),
        });
      }
      if (boardId === 'board-b') {
        return Promise.resolve({
          exists: () => true,
          data: () => ({
            title: 'Board B',
            ownerId: 'owner-b',
            createdAt: timestamp(1100),
            updatedAt: timestamp(4000),
          }),
        });
      }
      return Promise.resolve({
        exists: () => true,
        data: () => ({
          title: 'Board C',
          ownerId: 'owner-c',
          createdAt: timestamp(1200),
          updatedAt: timestamp(2000),
        }),
      });
    });

    const { result } = renderHook(() => useSharedBoards('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.explicitBoards.map((board) => board.id)).toEqual(['board-a', 'board-c']);
    expect(result.current.recentBoards.map((board) => board.id)).toEqual(['board-b']);
    expect(result.current.explicitBoards[0].source).toBe('explicit');
    expect(result.current.recentBoards[0].source).toBe('recent');
    expect(result.current.recentBoards[0].lastOpenedAtMs).toBe(7000);
  });

  it('keeps recents available when explicit-membership query fails', async () => {
    const recentSnapshot = snapshotFromDocs([
      {
        id: 'user-1_board-b',
        data: () => ({ boardId: 'board-b', userId: 'user-1', lastOpenedAt: timestamp(7000) }),
      },
    ]);

    mockGetDocs.mockImplementation((queryRef: { collectionRef: { name: string } }) => {
      if (queryRef.collectionRef.name === 'boardMembers') {
        return Promise.reject(new Error('member query failed'));
      }
      return Promise.resolve(recentSnapshot);
    });

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        title: 'Board B',
        ownerId: 'owner-b',
        createdAt: timestamp(1100),
        updatedAt: timestamp(4000),
      }),
    });

    const { result } = renderHook(() => useSharedBoards('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.explicitBoards).toHaveLength(0);
    expect(result.current.recentBoards).toHaveLength(1);
    expect(result.current.recentBoards[0].id).toBe('board-b');
  });

  it('returns an error when both shared queries fail', async () => {
    const failure = new Error('unavailable');
    mockGetDocs.mockRejectedValue(failure);
    mockToFirestoreUserMessage.mockReturnValue('Unable to load shared boards right now.');

    const { result } = renderHook(() => useSharedBoards('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.explicitBoards).toEqual([]);
    expect(result.current.recentBoards).toEqual([]);
    expect(result.current.error).toBe('Unable to load shared boards right now.');
    expect(mockToFirestoreUserMessage).toHaveBeenCalledWith(
      'Unable to load shared boards right now.',
      failure,
    );
  });
});
