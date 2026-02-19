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
import { logger } from '../lib/logger';
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
  userDisplayName?: string | null;
  access: ResolveBoardAccessResult | null;
  isSharePanelOpen: boolean;
  onSharingSaved?: (nextSharing: PersistedSharing) => void;
}

function isPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  return code === 'permission-denied';
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

function normalizeMemberDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function useBoardSharing({
  boardId,
  userId,
  userDisplayName,
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

    logger.info('FIRESTORE', `Saving share settings: visibility=${nextSharing.visibility}, authLinkRole=${nextSharing.authLinkRole}`, { boardId });

    try {
      await withFirestoreTimeout(
        'Saving share settings',
        updateDoc(doc(db, 'boards', boardId), {
          sharing: nextSharing,
          schemaVersion: 2,
          updatedAt: serverTimestamp(),
        }),
      );
      logger.info('FIRESTORE', `Share settings saved successfully`, { boardId, visibility: nextSharing.visibility });
      setDraft(nextSharing);
      setPendingPublicRole(nextSharing.visibility === 'public_link' ? nextSharing.publicLinkRole : null);
      setSettingsSuccess('Share settings saved.');
      onSharingSaved?.(nextSharing);
      return true;
    } catch (err) {
      const msg = toFirestoreUserMessage('Unable to save sharing settings.', err);
      logger.error('FIRESTORE', `Failed to save share settings: ${msg}`, { boardId });
      setSettingsError(msg);
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

    logger.info('FIRESTORE', 'Loading board members', { boardId });

    try {
      const snapshot = await withFirestoreTimeout(
        'Loading board members',
        getDocs(query(collection(db, 'boardMembers'), where('boardId', '==', boardId))),
      );

      let nextMembers = snapshot.docs
        .map((entry) => {
          const data = entry.data() as {
            boardId?: unknown;
            role?: unknown;
            userId?: unknown;
            displayName?: unknown;
          };
          const memberRole = normalizeMemberRole(data.role);
          const memberUserId = typeof data.userId === 'string' ? data.userId.trim() : '';
          const memberDisplayName =
            normalizeMemberDisplayName(data.displayName) ||
            (memberUserId === userId ? normalizeMemberDisplayName(userDisplayName) : null);
          if (!memberRole || !memberUserId) {
            return null;
          }
          return {
            membershipId: entry.id,
            boardId: typeof data.boardId === 'string' && data.boardId.trim() ? data.boardId : boardId,
            userId: memberUserId,
            role: memberRole,
            ...(memberDisplayName ? { displayName: memberDisplayName } : {}),
          } satisfies ShareMemberRoleEntry;
        })
        .filter((entry): entry is ShareMemberRoleEntry => Boolean(entry))
        .sort((a, b) => {
          const roleDelta = roleRank(a.role) - roleRank(b.role);
          if (roleDelta !== 0) {
            return roleDelta;
          }
          const nameA = (a.displayName || a.userId).toLowerCase();
          const nameB = (b.displayName || b.userId).toLowerCase();
          if (nameA !== nameB) {
            return nameA.localeCompare(nameB);
          }
          return a.userId.localeCompare(b.userId);
        });

      const missingNames = nextMembers.filter((member) => !member.displayName);
      if (missingNames.length > 0) {
        const resolvedMissingNames = await Promise.all(
          missingNames.map(async (member) => {
            try {
              const profileSnapshot = await withFirestoreTimeout(
                'Loading member profile',
                getDoc(doc(db, 'users', member.userId)),
              );
              if (!profileSnapshot.exists()) {
                return member;
              }

              const profileData = profileSnapshot.data() as {
                displayName?: unknown;
                email?: unknown;
              };
              const profileDisplayName =
                normalizeMemberDisplayName(profileData.displayName) ||
                normalizeMemberDisplayName(profileData.email);

              if (!profileDisplayName) {
                return member;
              }

              return {
                ...member,
                displayName: profileDisplayName,
              } satisfies ShareMemberRoleEntry;
            } catch {
              return member;
            }
          }),
        );

        const resolvedByMembershipId = new Map(
          resolvedMissingNames.map((member) => [member.membershipId, member]),
        );
        nextMembers = nextMembers.map(
          (member) => resolvedByMembershipId.get(member.membershipId) || member,
        );
      }

      logger.info('FIRESTORE', `Loaded ${nextMembers.length} board member(s)`, { boardId, memberCount: nextMembers.length });
      setMembers(nextMembers);
    } catch (err) {
      const msg = toFirestoreUserMessage('Unable to load members.', err);
      logger.error('FIRESTORE', `Failed to load board members: ${msg}`, { boardId });
      setMembersError(msg);
    } finally {
      setMembersLoading(false);
    }
  }, [boardId, canManageSharing, userDisplayName, userId]);

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

      logger.info('FIRESTORE', `Updating member role to '${role}'`, { membershipId, boardId });

      try {
        await withFirestoreTimeout(
          'Updating board member role',
          updateDoc(doc(db, 'boardMembers', membershipId), {
            role,
            updatedAt: serverTimestamp(),
          }),
        );
        logger.info('FIRESTORE', `Member role updated to '${role}'`, { membershipId });
        setMembers((previous) =>
          previous.map((member) => (member.membershipId === membershipId ? { ...member, role } : member)),
        );
        return true;
      } catch (err) {
        logger.error('FIRESTORE', `Failed to update member role: ${err instanceof Error ? err.message : 'Unknown error'}`, { membershipId });
        setMembersError(toFirestoreUserMessage('Unable to update member role.', err));
        return false;
      }
    },
    [boardId, canManageSharing],
  );

  const removeMember = useCallback(
    async (membershipId: string) => {
      if (!canManageSharing) {
        return false;
      }

      setMembersError(null);

      logger.info('FIRESTORE', `Removing board member`, { membershipId, boardId });

      try {
        await withFirestoreTimeout(
          'Removing board member',
          deleteDoc(doc(db, 'boardMembers', membershipId)),
        );
        logger.info('FIRESTORE', `Board member removed`, { membershipId });
        setMembers((previous) => previous.filter((member) => member.membershipId !== membershipId));
        return true;
      } catch (err) {
        logger.error('FIRESTORE', `Failed to remove board member: ${err instanceof Error ? err.message : 'Unknown error'}`, { membershipId });
        setMembersError(toFirestoreUserMessage('Unable to remove member.', err));
        return false;
      }
    },
    [boardId, canManageSharing],
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

    const normalizedCurrentDisplayName = normalizeMemberDisplayName(userDisplayName);
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
        const existingDisplayName = normalizeMemberDisplayName(
          (existingSnapshot.data() as { displayName?: unknown }).displayName,
        );

        if (
          normalizedCurrentDisplayName &&
          normalizedCurrentDisplayName !== existingDisplayName
        ) {
          try {
            await withFirestoreTimeout(
              'Refreshing workspace member profile',
              updateDoc(membershipRef, {
                displayName: normalizedCurrentDisplayName,
                updatedAt: serverTimestamp(),
              }),
            );
          } catch (err) {
            if (!isPermissionDeniedError(err)) {
              throw err;
            }
            // Some deployments only allow owner updates on boardMembers.
            // Keep Save to workspace successful for existing memberships.
          }
        }
        setWorkspaceState('saved');
        return true;
      }

      const preferredRole: ShareRole = access.effectiveRole === 'editor' ? 'editor' : 'viewer';
      const candidateRoles: ShareRole[] =
        preferredRole === 'editor' ? ['editor', 'viewer'] : ['viewer'];

      let lastError: unknown = null;
      let saved = false;

      for (let index = 0; index < candidateRoles.length; index += 1) {
        const role = candidateRoles[index];
        try {
          await withFirestoreTimeout(
            'Saving board to workspace',
            setDoc(membershipRef, {
              boardId,
              userId,
              role,
              ...(normalizedCurrentDisplayName ? { displayName: normalizedCurrentDisplayName } : {}),
              addedAt: serverTimestamp(),
              addedBy: userId,
              updatedAt: serverTimestamp(),
            }),
          );
          saved = true;
          break;
        } catch (err) {
          lastError = err;
          if (!(isPermissionDeniedError(err) && index < candidateRoles.length - 1)) {
            throw err;
          }
        }
      }

      if (!saved && lastError) {
        throw lastError;
      }

      setWorkspaceState('saved');
      return true;
    } catch (err) {
      setWorkspaceState('error');
      setWorkspaceError(toFirestoreUserMessage('Unable to save board to workspace.', err));
      return false;
    }
  }, [access, boardId, canSaveToWorkspace, userDisplayName, userId]);

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
