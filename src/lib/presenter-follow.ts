import type { RemoteCursor } from '../hooks/useCursors';

export interface FollowCandidate extends RemoteCursor {}

export function buildFollowCandidates(
  remoteCursors: RemoteCursor[],
  currentUserId: string | null,
): FollowCandidate[] {
  const byUserId = new Map<string, FollowCandidate>();
  for (const cursor of remoteCursors) {
    const userId = cursor.userId?.trim();
    if (!userId) {
      continue;
    }
    if (currentUserId && userId === currentUserId) {
      continue;
    }
    if (!byUserId.has(userId)) {
      byUserId.set(userId, cursor);
    }
  }
  return Array.from(byUserId.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function getActiveFollowCursor(
  candidates: FollowCandidate[],
  followedUserId: string | null,
): FollowCandidate | null {
  if (!followedUserId) {
    return null;
  }
  const match = candidates.find((candidate) => candidate.userId === followedUserId);
  return match || null;
}
