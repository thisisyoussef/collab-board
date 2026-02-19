import type {
  BoardRole,
  BoardSharingConfig,
  BoardVisibility,
  ShareRole,
} from '../types/sharing.js';
export type {
  BoardRole,
  BoardSharingConfig,
  BoardVisibility,
  ShareRole,
} from '../types/sharing.js';

export interface ResolveBoardAccessInput {
  ownerId?: string | null;
  userId?: string | null;
  isAuthenticated: boolean;
  explicitMemberRole?: BoardRole | null;
  sharing?: Partial<{
    visibility: string;
    authLinkRole: string;
    publicLinkRole: string;
  }> | null;
}

export interface ResolveBoardAccessResult extends BoardSharingConfig {
  effectiveRole: BoardRole;
  canRead: boolean;
  canEdit: boolean;
  canApplyAI: boolean;
}

function normalizeShareRole(value: unknown, fallback: ShareRole): ShareRole {
  return value === 'editor' || value === 'viewer' ? value : fallback;
}

function normalizeVisibility(value: unknown): BoardVisibility | null {
  if (value === 'private' || value === 'auth_link' || value === 'public_link') {
    return value;
  }
  return null;
}

export function normalizeBoardRole(value: unknown): BoardRole | null {
  if (value === 'owner' || value === 'editor' || value === 'viewer') {
    return value;
  }
  return null;
}

export function normalizeBoardSharingConfig(
  sharing: ResolveBoardAccessInput['sharing'],
): BoardSharingConfig {
  const visibility = normalizeVisibility(sharing?.visibility);
  const isLegacyFallback = visibility === null;

  return {
    visibility: visibility || 'auth_link',
    authLinkRole: normalizeShareRole(sharing?.authLinkRole, 'editor'),
    publicLinkRole: normalizeShareRole(sharing?.publicLinkRole, 'viewer'),
    isLegacyFallback,
  };
}

export function resolveBoardAccess({
  ownerId,
  userId,
  isAuthenticated,
  explicitMemberRole,
  sharing,
}: ResolveBoardAccessInput): ResolveBoardAccessResult {
  const normalizedOwnerId = typeof ownerId === 'string' ? ownerId.trim() : '';
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  const normalizedMemberRole = normalizeBoardRole(explicitMemberRole);
  const sharingConfig = normalizeBoardSharingConfig(sharing);

  let effectiveRole: BoardRole = 'none';

  if (
    isAuthenticated &&
    normalizedOwnerId &&
    normalizedUserId &&
    normalizedOwnerId === normalizedUserId
  ) {
    effectiveRole = 'owner';
  } else if (normalizedMemberRole) {
    effectiveRole = normalizedMemberRole;
  } else if (sharingConfig.visibility === 'private') {
    effectiveRole = 'none';
  } else if (sharingConfig.visibility === 'auth_link') {
    effectiveRole = isAuthenticated ? sharingConfig.authLinkRole : 'none';
  } else {
    effectiveRole = sharingConfig.publicLinkRole;
  }

  const canRead = effectiveRole !== 'none';
  const canEdit = effectiveRole === 'owner' || effectiveRole === 'editor';
  const canApplyAI = canEdit && isAuthenticated;

  return {
    ...sharingConfig,
    effectiveRole,
    canRead,
    canEdit,
    canApplyAI,
  };
}

export function shouldRedirectToSignIn(
  access: ResolveBoardAccessResult,
  isAuthenticated: boolean,
): boolean {
  return !isAuthenticated && !access.canRead && access.visibility !== 'public_link';
}
