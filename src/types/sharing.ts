export type BoardVisibility = 'private' | 'auth_link' | 'public_link';
export type BoardRole = 'owner' | 'editor' | 'viewer' | 'none';
export type ShareRole = 'editor' | 'viewer';

export interface BoardSharingConfig {
  visibility: BoardVisibility;
  authLinkRole: ShareRole;
  publicLinkRole: ShareRole;
  isLegacyFallback: boolean;
}

export interface ShareMemberRoleEntry {
  membershipId: string;
  boardId: string;
  userId: string;
  role: Exclude<BoardRole, 'none'>;
}
