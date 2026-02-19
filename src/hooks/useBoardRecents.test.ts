import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBoardRecents } from './useBoardRecents';

const mockDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockServerTimestamp = vi.fn(() => 'server-timestamp');

const mockWithFirestoreTimeout = vi.fn((_: string, promise: Promise<unknown>) => promise);
const mockToFirestoreUserMessage = vi.fn((fallback: string) => fallback);

vi.mock('firebase/firestore/lite', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  serverTimestamp: (...args: unknown[]) => mockServerTimestamp(...args),
}));

vi.mock('../lib/firebase', () => ({
  db: { app: 'test-db' },
}));

vi.mock('../lib/firestore-client', () => ({
  withFirestoreTimeout: (...args: [string, Promise<unknown>]) => mockWithFirestoreTimeout(...args),
  toFirestoreUserMessage: (...args: [string, unknown]) => mockToFirestoreUserMessage(...args),
}));

describe('useBoardRecents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockImplementation((_db: unknown, collectionName: string, docId: string) => ({
      id: docId,
      path: `${collectionName}/${docId}`,
    }));
    mockSetDoc.mockResolvedValue(undefined);
    mockWithFirestoreTimeout.mockImplementation((_: string, promise: Promise<unknown>) => promise);
    mockToFirestoreUserMessage.mockImplementation((fallback: string) => fallback);
  });

  it('writes board recent entry when user opens an accessible board', async () => {
    const { result } = renderHook(() =>
      useBoardRecents({ boardId: 'board-1', userId: 'user-1', enabled: true }),
    );

    await waitFor(() => {
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
    });

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'boardRecents/user-1_board-1' }),
      expect.objectContaining({
        boardId: 'board-1',
        userId: 'user-1',
        lastOpenedAt: 'server-timestamp',
        updatedAt: 'server-timestamp',
      }),
      { merge: true },
    );
    expect(result.current.error).toBeNull();
  });

  it('does not write when disabled or unauthenticated', async () => {
    renderHook(() => useBoardRecents({ boardId: 'board-1', userId: 'user-1', enabled: false }));
    renderHook(() => useBoardRecents({ boardId: 'board-1', userId: null, enabled: true }));

    await waitFor(() => {
      expect(mockSetDoc).not.toHaveBeenCalled();
    });
  });

  it('updates timestamp again when board is reopened', async () => {
    const first = renderHook(() =>
      useBoardRecents({ boardId: 'board-1', userId: 'user-1', enabled: true }),
    );

    await waitFor(() => {
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
    });

    first.unmount();

    renderHook(() => useBoardRecents({ boardId: 'board-1', userId: 'user-1', enabled: true }));

    await waitFor(() => {
      expect(mockSetDoc).toHaveBeenCalledTimes(2);
    });
  });
});
