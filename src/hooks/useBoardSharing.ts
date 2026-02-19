import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore/lite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ResolveBoardAccessResult } from '../lib/access';
import { toFirestoreUserMessage, withFirestoreTimeout } from '../lib/firestore-client';
import { db } from '../lib/firebase';
import type { BoardRole, BoardVisibility, ShareMemberRoleEntry, ShareRole } from '../types/sharing';

type PersistedSharing = {
  visibility: BoardVisibility;
  authLinkRole: ShareRole;
  publicLinkRole: ShareRole;
};

type WorkspaceState = 'idle' | 'saving' | 'saved' | 'error';

interface UseBoardSharingOptions {
  boardId?: string;
  userId?: string | null;
  access: ResolveBoardAccessResult | null;
  isSharePanelOpen: boolean;
  onSharingSaved?: (nextSharing: PersistedSharing) => void;
}

function normalizeMemberRole(value: unknown): Exclude<BoardRole, 'none'> | null {
  if (value === 'owner' || value === 'editor' || value === 'viewer') {
    return value;
  }
  return null;
}

function roleRank(role: Exclude<BoardRole, 'none'>): number {
  if (role === 'owner') {
    return 0;
  }
  return role === 'editor' ? 1 : 2;
}

export function useBoardSharing({
  boardId,
  userId,
  access,
  isSharePanelOpen,
  onSharingSaved,
}: UseBoardSharingOptions) {
  const persistedSharing = useMemo<PersistedSharing>(
    () => ({
      visibility: access?.visibility ?? 'private',
      authLinkRole: access?.authLinkRole ?? 'editor',
      publicLinkRole: access?.publicLinkRole ?? 'viewer',
    }),
    [access?.authLinkRole, access?.publicLinkRole, access?.visibility],
  );

  const canManageSharing = access?.effectiveRole === 'owner';
  const [draft, setDraft] = useState<PersistedSharing>(persistedSharing);
  const [pendingPublicRole, setPendingPublicRole] = useState<ShareRole | null>(
    persistedSharing.visibility === 'public_link' ? persistedSharing.publicLinkRole : null,
  );
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [members, setMembers] = useState<ShareMemberRoleEntry[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>('idle');
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(persistedSharing);
    setPendingPublicRole(
      persistedSharing.visibility === 'public_link' ? persistedSharing.publicLinkRole : null,
    );
    setSettingsError(null);
    setSettingsSuccess(null);
  }, [persistedSharing]);

  useEffect(() => {
    setWorkspaceState('idle');
    setWorkspaceError(null);
  }, [boardId, userId]);

  const setVisibility = useCallback(
    (visibility: BoardVisibility) => {
      setDraft((previous) => ({ ...previous, visibility }));
      if (visibility === 'public_link') {
        setPendingPublicRole((previous) =>
          previous ?? (persistedSharing.visibility === 'public_link' ? persistedSharing.publicLinkRole : null),
        );
      } else {
        setPendingPublicRole(null);
      }
      setSettingsError(null);
      setSettingsSuccess(null);
    },
    [persistedSharing.publicLinkRole, persistedSharing.visibility],
  );

  const setAuthLinkRole = useCallback((role: ShareRole) => {
    setDraft((previous) => ({ ...previous, authLinkRole: role }));
    setSettingsError(null);
    setSettingsSuccess(null);
  }, []);

  const setPublicLinkRole = useCallback((role: ShareRole) => {
    setPendingPublicRole(role);
    setDraft((previous) => ({ ...previous, publicLinkRole: role }));
    setSettingsError(null);
    setSettingsSuccess(null);
  }, []);

  const requiresPublicRoleSelection =
    draft.visibility === 'public_link' &&
    persistedSharing.visibility !== 'public_link' &&
    pendingPublicRole === null;

  const saveSharingSettings = useCallback(async () => {
    if (!boardId || !canManageSharing) {
      return false;
    }

    if (requiresPublicRoleSelection) {
      setSettingsError('Choose public-link role before saving.');
      setSettingsSuccess(null);
      return false;
    }

    const nextPublicRole =
      draft.visibility === 'public_link' && persistedSharing.visibility !== 'public_link'
        ? pendingPublicRole || draft.publicLinkRole
        : draft.publicLinkRole;

    const nextSharing: PersistedSharing = {
      visibility: draft.visibility,
      authLinkRole: draft.authLinkRole,
      publicLinkRole: nextPublicRole,
    };

    setSettingsSaving(true);
    setSettingsError(null);
    try {
      await withFirestoreTimeout(
        'Saving share settings',
        updateDoc(doc(db, 'boards', boardId), {
          sharing: nextSharing,
          schemaVersion: 2,
          updatedAt: serverTimestamp(),
        }),
      );
      setDraft(nextSharing);
      setPendingPublicRole(nextSharing.visibility === 'public_link' ? nextSharing.publicLinkRole : null);
      setSettingsSuccess('Share settings saved.');
      onSharingSaved?.(nextSharing);
      return true;
    } catch (err) {
      setSettingsError(toFirestoreUserMessage('Unable to save sharing settings.', err));
      setSettingsSuccess(null);
      return false;
    } finally {
      setSettingsSaving(false);
    }
  }, [
    boardId,
    canManageSharing,
    draft.authLinkRole,
    draft.publicLinkRole,
    draft.visibility,
    onSharingSaved,
    pendingPublicRole,
    persistedSharing.visibility,
    requiresPublicRoleSelection,
  ]);

  const loadMembers = useCallback(async () => {
    if (!boardId || !canManageSharing) {
      setMembers([]);
      setMembersLoading(false);
      setMembersError(null);
      return;
    }

    setMembersLoading(true);
    setMembersError(null);
    try {
      const snapshot = await withFirestoreTimeout(
        'Loading board members',
        getDocs(query(collection(db, 'boardMembers'), where('boardId', '==', boardId))),
      );

      const nextMembers = snapshot.docs
        .map((entry) => {
          const data = entry.data() as {
            boardId?: unknown;
            role?: unknown;
            userId?: unknown;
          };
          const memberRole = normalizeMemberRole(data.role);
          const memberUserId = typeof data.userId === 'string' ? data.userId.trim() : '';
          if (!memberRole || !memberUserId) {
            return null;
          }
          return {
            membershipId: entry.id,
            boardId: typeof data.boardId === 'string' && data.boardId.trim() ? data.boardId : boardId,
            userId: memberUserId,
            role: memberRole,
          } satisfies ShareMemberRoleEntry;
        })
        .filter((entry): entry is ShareMemberRoleEntry => Boolean(entry))
        .sort((a, b) => {
          const roleDelta = roleRank(a.role) - roleRank(b.role);
          if (roleDelta !== 0) {
            return roleDelta;
          }
          return a.userId.localeCompare(b.userId);
        });

      setMembers(nextMembers);
    } catch (err) {
      setMembersError(toFirestoreUserMessage('Unable to load members.', err));
    } finally {
      setMembersLoading(false);
    }
  }, [boardId, canManageSharing]);

  useEffect(() => {
    if (!isSharePanelOpen || !canManageSharing) {
      return;
    }
    void loadMembers();
  }, [canManageSharing, isSharePanelOpen, loadMembers]);

  const updateMemberRole = useCallback(
    async (membershipId: string, role: ShareRole) => {
      if (!canManageSharing) {
        return false;
      }

      setMembersError(null);
      try {
        await withFirestoreTimeout(
          'Updating board member role',
          updateDoc(doc(db, 'boardMembers', membershipId), {
            role,
            updatedAt: serverTimestamp(),
          }),
        );
        setMembers((previous) =>
          previous.map((member) => (member.membershipId === membershipId ? { ...member, role } : member)),
        );
        return true;
      } catch (err) {
        setMembersError(toFirestoreUserMessage('Unable to update member role.', err));
        return false;
      }
    },
    [canManageSharing],
  );

  const removeMember = useCallback(
    async (membershipId: string) => {
      if (!canManageSharing) {
        return false;
      }

      setMembersError(null);
      try {
        await withFirestoreTimeout(
          'Removing board member',
          deleteDoc(doc(db, 'boardMembers', membershipId)),
        );
        setMembers((previous) => previous.filter((member) => member.membershipId !== membershipId));
        return true;
      } catch (err) {
        setMembersError(toFirestoreUserMessage('Unable to remove member.', err));
        return false;
      }
    },
    [canManageSharing],
  );

  const canSaveToWorkspace = Boolean(
    boardId &&
      userId &&
      access &&
      access.effectiveRole !== 'none' &&
      access.effectiveRole !== 'owner',
  );

  const saveToWorkspace = useCallback(async () => {
    if (!boardId || !userId || !access || !canSaveToWorkspace) {
      return false;
    }

    setWorkspaceState('saving');
    setWorkspaceError(null);

    try {
      const membershipId = `${boardId}_${userId}`;
      const membershipRef = doc(db, 'boardMembers', membershipId);
      const existingSnapshot = await withFirestoreTimeout(
        'Loading workspace membership',
        getDoc(membershipRef),
      );

      if (existingSnapshot.exists()) {
        setWorkspaceState('saved');
        return true;
      }

      const role: ShareRole = access.effectiveRole === 'editor' ? 'editor' : 'viewer';
      await withFirestoreTimeout(
        'Saving board to workspace',
        setDoc(membershipRef, {
          boardId,
          userId,
          role,
          addedAt: serverTimestamp(),
          addedBy: userId,
          updatedAt: serverTimestamp(),
        }),
      );

      setWorkspaceState('saved');
      return true;
    } catch (err) {
      setWorkspaceState('error');
      setWorkspaceError(toFirestoreUserMessage('Unable to save board to workspace.', err));
      return false;
    }
  }, [access, boardId, canSaveToWorkspace, userId]);

  return {
    canManageSharing,
    canSaveToWorkspace,
    draft,
    members,
    membersError,
    membersLoading,
    pendingPublicRole,
    requiresPublicRoleSelection,
    saveSharingSettings,
    saveToWorkspace,
    settingsError,
    settingsSaving,
    settingsSuccess,
    setAuthLinkRole,
    setPublicLinkRole,
    setVisibility,
    updateMemberRole,
    removeMember,
    loadMembers,
    workspaceError,
    workspaceState,
  };
}
