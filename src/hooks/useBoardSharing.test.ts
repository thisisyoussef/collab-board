import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolveBoardAccessResult } from '../lib/access';
import { useBoardSharing } from './useBoardSharing';

const mockCollection = vi.fn();
const mockDeleteDoc = vi.fn();
const mockDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockQuery = vi.fn();
const mockServerTimestamp = vi.fn(() => 'mock-ts');
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockWhere = vi.fn();

const mockWithFirestoreTimeout = vi.fn((_: string, promise: Promise<unknown>) => promise);
const mockToFirestoreUserMessage = vi.fn((fallback: string) => fallback);

vi.mock('firebase/firestore/lite', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  serverTimestamp: (...args: unknown[]) => mockServerTimestamp(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  where: (...args: unknown[]) => mockWhere(...args),
}));

vi.mock('../lib/firebase', () => ({
  db: { app: 'test-db' },
}));

vi.mock('../lib/firestore-client', () => ({
  withFirestoreTimeout: (...args: [string, Promise<unknown>]) => mockWithFirestoreTimeout(...args),
  toFirestoreUserMessage: (...args: [string, unknown]) => mockToFirestoreUserMessage(...args),
}));

const ownerAccess: ResolveBoardAccessResult = {
  visibility: 'private',
  authLinkRole: 'editor',
  publicLinkRole: 'viewer',
  isLegacyFallback: false,
  effectiveRole: 'owner',
  canRead: true,
  canEdit: true,
  canApplyAI: true,
};

function memberSnapshot(
  members: Array<{ id: string; userId: string; role: 'editor' | 'viewer'; displayName?: string }>,
) {
  return {
    docs: members.map((member) => ({
      id: member.id,
      data: () => ({
        boardId: 'board-1',
        userId: member.userId,
        role: member.role,
        ...(member.displayName ? { displayName: member.displayName } : {}),
      }),
    })),
  };
}

describe('useBoardSharing', () => {
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
    mockGetDocs.mockResolvedValue(memberSnapshot([]));
    mockGetDoc.mockResolvedValue({
      exists: () => false,
      data: () => ({}),
    });
    mockSetDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockWithFirestoreTimeout.mockImplementation((_: string, promise: Promise<unknown>) => promise);
    mockToFirestoreUserMessage.mockImplementation((fallback: string) => fallback);
  });

  it('requires selecting public-link role when enabling public visibility', async () => {
    const { result } = renderHook(() =>
      useBoardSharing({
        boardId: 'board-1',
        userId: 'owner-1',
        access: ownerAccess,
        isSharePanelOpen: false,
      }),
    );

    act(() => {
      result.current.setVisibility('public_link');
    });

    await act(async () => {
      await expect(result.current.saveSharingSettings()).resolves.toBe(false);
    });

    expect(result.current.settingsError).toBe('Choose public-link role before saving.');
    expect(mockUpdateDoc).not.toHaveBeenCalled();

    act(() => {
      result.current.setPublicLinkRole('editor');
    });

    await act(async () => {
      await expect(result.current.saveSharingSettings()).resolves.toBe(true);
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'boards/board-1' }),
      expect.objectContaining({
        sharing: {
          visibility: 'public_link',
          authLinkRole: 'editor',
          publicLinkRole: 'editor',
        },
      }),
    );
  });

  it('loads members for owners and supports role update/remove', async () => {
    mockGetDocs.mockResolvedValue(
      memberSnapshot([
        { id: 'board-1_user-2', userId: 'user-2', role: 'viewer', displayName: 'Sam Doe' },
        { id: 'board-1_user-3', userId: 'user-3', role: 'editor', displayName: 'Alex Doe' },
      ]),
    );

    const { result } = renderHook(() =>
      useBoardSharing({
        boardId: 'board-1',
        userId: 'owner-1',
        access: ownerAccess,
        isSharePanelOpen: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.members).toHaveLength(2);
    });
    expect(result.current.members[0].displayName).toBe('Alex Doe');
    expect(result.current.members[1].displayName).toBe('Sam Doe');

    await act(async () => {
      await expect(result.current.updateMemberRole('board-1_user-2', 'editor')).resolves.toBe(true);
    });
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'boardMembers/board-1_user-2' }),
      expect.objectContaining({ role: 'editor' }),
    );

    await act(async () => {
      await expect(result.current.removeMember('board-1_user-3')).resolves.toBe(true);
    });
    expect(mockDeleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'boardMembers/board-1_user-3' }),
    );
  });

  it('hydrates missing member display names from user profiles', async () => {
    mockGetDocs.mockResolvedValue(
      memberSnapshot([
        { id: 'board-1_user-2', userId: 'user-2', role: 'viewer' },
      ]),
    );
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ displayName: 'Profile Name' }),
    });

    const { result } = renderHook(() =>
      useBoardSharing({
        boardId: 'board-1',
        userId: 'owner-1',
        access: ownerAccess,
        isSharePanelOpen: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.members).toHaveLength(1);
    });
    expect(result.current.members[0].displayName).toBe('Profile Name');
  });

  it('saves shared boards to workspace for non-owner users', async () => {
    const editorAccess: ResolveBoardAccessResult = {
      ...ownerAccess,
      effectiveRole: 'editor',
      canApplyAI: true,
    };

    const { result } = renderHook(() =>
      useBoardSharing({
        boardId: 'board-1',
        userId: 'user-2',
        userDisplayName: 'Test User',
        access: editorAccess,
        isSharePanelOpen: false,
      }),
    );

    await act(async () => {
      await expect(result.current.saveToWorkspace()).resolves.toBe(true);
    });

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'boardMembers/board-1_user-2' }),
      expect.objectContaining({
        boardId: 'board-1',
        userId: 'user-2',
        role: 'editor',
        displayName: 'Test User',
      }),
    );
    expect(result.current.workspaceState).toBe('saved');
  });

  it('does not fail save-to-workspace if existing membership display-name refresh is denied', async () => {
    const editorAccess: ResolveBoardAccessResult = {
      ...ownerAccess,
      effectiveRole: 'editor',
      canApplyAI: true,
    };

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ displayName: 'Old Name' }),
    });
    mockUpdateDoc.mockRejectedValueOnce(
      Object.assign(new Error('permission denied'), { code: 'permission-denied' }),
    );

    const { result } = renderHook(() =>
      useBoardSharing({
        boardId: 'board-1',
        userId: 'user-2',
        userDisplayName: 'Fresh Name',
        access: editorAccess,
        isSharePanelOpen: false,
      }),
    );

    await act(async () => {
      await expect(result.current.saveToWorkspace()).resolves.toBe(true);
    });

    expect(result.current.workspaceState).toBe('saved');
  });

  it('falls back to viewer workspace save when editor role is denied', async () => {
    const editorAccess: ResolveBoardAccessResult = {
      ...ownerAccess,
      effectiveRole: 'editor',
      canApplyAI: true,
    };

    mockSetDoc
      .mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'permission-denied' }))
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useBoardSharing({
        boardId: 'board-1',
        userId: 'user-2',
        access: editorAccess,
        isSharePanelOpen: false,
      }),
    );

    await act(async () => {
      await expect(result.current.saveToWorkspace()).resolves.toBe(true);
    });

    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    expect(mockSetDoc).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({ role: 'editor' }),
    );
    expect(mockSetDoc).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ role: 'viewer' }),
    );
    expect(result.current.workspaceState).toBe('saved');
  });
});
