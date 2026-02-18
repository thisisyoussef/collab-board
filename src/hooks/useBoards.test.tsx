import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBoards } from './useBoards';

const mockCollection = vi.fn();
const mockWhere = vi.fn();
const mockQuery = vi.fn();
const mockGetDocs = vi.fn();
const mockDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockServerTimestamp = vi.fn(() => 'server-timestamp');

const mockWithFirestoreTimeout = vi.fn((_: string, promise: Promise<unknown>) => promise);
const mockToFirestoreUserMessage = vi.fn((fallback: string) => fallback);

vi.mock('firebase/firestore/lite', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  serverTimestamp: (...args: unknown[]) => mockServerTimestamp(...args),
}));

vi.mock('../lib/firebase', () => ({
  db: { app: 'test-db' },
}));

vi.mock('../lib/firestore-client', () => ({
  withFirestoreTimeout: (...args: [string, Promise<unknown>]) => mockWithFirestoreTimeout(...args),
  toFirestoreUserMessage: (...args: [string, unknown]) => mockToFirestoreUserMessage(...args),
}));

interface SnapshotDoc {
  id: string;
  data: () => Record<string, unknown>;
}

function timestamp(ms: number) {
  return {
    toMillis: () => ms,
  };
}

function snapshotFromDocs(docs: SnapshotDoc[]) {
  return { docs };
}

describe('useBoards', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCollection.mockImplementation((_db: unknown, name: string) => ({ kind: 'collection', name }));
    mockWhere.mockImplementation((field: string, op: string, value: string) => ({
      kind: 'where',
      field,
      op,
      value,
    }));
    mockQuery.mockImplementation((collectionRef: unknown, whereClause: unknown) => ({
      kind: 'query',
      collectionRef,
      whereClause,
    }));
    mockGetDocs.mockResolvedValue(snapshotFromDocs([]));
    mockDoc.mockImplementation((...args: unknown[]) => {
      if (args.length === 1) {
        return { id: 'board-new', path: 'boards/board-new' };
      }
      if (args.length === 3) {
        return { id: String(args[2]), path: `boards/${String(args[2])}` };
      }
      return { id: 'unknown', path: 'unknown' };
    });
    mockSetDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockWithFirestoreTimeout.mockImplementation((_: string, promise: Promise<unknown>) => promise);
    mockToFirestoreUserMessage.mockImplementation((fallback: string) => fallback);
  });

  it('returns empty state when user is not authenticated', () => {
    const { result } = renderHook(() => useBoards(undefined));

    expect(result.current.boards).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('loads boards from ownerId and createdBy, de-duplicates, and sorts by updatedAt', async () => {
    const ownerDocs = snapshotFromDocs([
      {
        id: 'board-1',
        data: () => ({
          title: 'Owned Board',
          ownerId: 'user-1',
          createdAt: timestamp(1000),
          updatedAt: timestamp(2000),
        }),
      },
    ]);

    const createdDocs = snapshotFromDocs([
      {
        id: 'board-2',
        data: () => ({
          title: 'Created Board',
          createdBy: 'user-1',
          createdAt: timestamp(3000),
          updatedAt: timestamp(4000),
        }),
      },
      {
        id: 'board-1',
        data: () => ({
          title: 'Duplicate Via createdBy',
          createdBy: 'user-1',
          createdAt: timestamp(500),
          updatedAt: timestamp(1000),
        }),
      },
    ]);

    mockGetDocs.mockImplementation((queryRef: { whereClause: { field: string } }) => {
      if (queryRef.whereClause.field === 'ownerId') {
        return Promise.resolve(ownerDocs);
      }
      return Promise.resolve(createdDocs);
    });

    const { result } = renderHook(() => useBoards('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.boards.map((item) => item.id)).toEqual(['board-2', 'board-1']);
    expect(result.current.boards[0].ownerId).toBe('user-1');
    expect(result.current.boards[1].title).toBe('Owned Board');
  });

  it('surfaces an error when both load queries fail', async () => {
    const failure = new Error('firestore unavailable');
    mockGetDocs.mockRejectedValue(failure);
    mockToFirestoreUserMessage.mockReturnValue('Unable to load boards right now.');

    const { result } = renderHook(() => useBoards('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.boards).toEqual([]);
    expect(result.current.error).toBe('Unable to load boards right now.');
    expect(mockToFirestoreUserMessage).toHaveBeenCalledWith(
      'Unable to load boards right now.',
      failure,
    );
  });

  it('creates a board optimistically and commits it', async () => {
    const { result } = renderHook(() => useBoards('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let created: ReturnType<typeof result.current.createBoard> | null = null;
    act(() => {
      created = result.current.createBoard('  Sprint Planning  ');
    });

    expect(created?.id).toBe('board-new');
    expect(result.current.boards[0]).toMatchObject({
      id: 'board-new',
      ownerId: 'user-1',
      title: 'Sprint Planning',
    });

    await expect(created?.committed).resolves.toBeUndefined();
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'board-new' }),
      expect.objectContaining({
        ownerId: 'user-1',
        createdBy: 'user-1',
        title: 'Sprint Planning',
        objects: {},
      }),
    );
  });

  it('throws when createBoard is called without an authenticated user', () => {
    const { result } = renderHook(() => useBoards(undefined));
    expect(() => result.current.createBoard('Board')).toThrow('Not authenticated');
  });

  it('rolls back a failed rename', async () => {
    const ownerDocs = snapshotFromDocs([
      {
        id: 'board-1',
        data: () => ({
          title: 'Original Name',
          ownerId: 'user-1',
          createdAt: timestamp(1000),
          updatedAt: timestamp(1500),
        }),
      },
    ]);

    mockGetDocs.mockImplementation((queryRef: { whereClause: { field: string } }) => {
      if (queryRef.whereClause.field === 'ownerId') {
        return Promise.resolve(ownerDocs);
      }
      return Promise.resolve(snapshotFromDocs([]));
    });
    mockUpdateDoc.mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('rename failed')), 0);
        }),
    );
    mockToFirestoreUserMessage.mockReturnValue('Failed to rename board.');

    const { result } = renderHook(() => useBoards('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.renameBoard('board-1', 'Updated Name')).rejects.toThrow(
        'Failed to rename board.',
      );
    });

    await waitFor(() => {
      expect(result.current.boards.find((item) => item.id === 'board-1')?.title).toBe(
        'Original Name',
      );
    });
  });

  it('rejects blank rename values before touching Firestore', async () => {
    const { result } = renderHook(() => useBoards('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(result.current.renameBoard('board-1', '   ')).rejects.toThrow(
      'Board name cannot be empty',
    );
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('rolls back optimistic delete when Firestore delete fails', async () => {
    const ownerDocs = snapshotFromDocs([
      {
        id: 'board-1',
        data: () => ({
          title: 'Delete Me',
          ownerId: 'user-1',
          createdAt: timestamp(1000),
          updatedAt: timestamp(2000),
        }),
      },
    ]);

    mockGetDocs.mockImplementation((queryRef: { whereClause: { field: string } }) => {
      if (queryRef.whereClause.field === 'ownerId') {
        return Promise.resolve(ownerDocs);
      }
      return Promise.resolve(snapshotFromDocs([]));
    });
    mockDeleteDoc.mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('delete failed')), 0);
        }),
    );
    mockToFirestoreUserMessage.mockReturnValue('Failed to delete board.');

    const { result } = renderHook(() => useBoards('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.removeBoard('board-1')).rejects.toThrow(
        'Failed to delete board.',
      );
    });

    await waitFor(() => {
      expect(result.current.boards.some((item) => item.id === 'board-1')).toBe(true);
    });
  });
});
