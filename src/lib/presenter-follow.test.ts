import { describe, expect, it } from 'vitest';
import type { RemoteCursor } from '../hooks/useCursors';
import { buildFollowCandidates, getActiveFollowCursor } from './presenter-follow';

const CURSOR_BASE: RemoteCursor = {
  socketId: 'socket-1',
  userId: 'user-1',
  displayName: 'User One',
  color: '#123456',
  x: 100,
  y: 200,
};

describe('presenter-follow helpers', () => {
  it('returns unique non-self follow candidates by user id', () => {
    const cursors: RemoteCursor[] = [
      CURSOR_BASE,
      { ...CURSOR_BASE, socketId: 'socket-2', x: 120 },
      { ...CURSOR_BASE, userId: 'self-user', socketId: 'socket-self' },
      { ...CURSOR_BASE, userId: 'user-2', displayName: 'User Two', socketId: 'socket-3' },
    ];

    expect(buildFollowCandidates(cursors, 'self-user')).toEqual([
      expect.objectContaining({ userId: 'user-1' }),
      expect.objectContaining({ userId: 'user-2' }),
    ]);
  });

  it('resolves the actively followed cursor by selected user id', () => {
    const cursors: RemoteCursor[] = [
      CURSOR_BASE,
      { ...CURSOR_BASE, userId: 'user-2', socketId: 'socket-2', x: 320, y: 410 },
    ];
    const candidates = buildFollowCandidates(cursors, 'self-user');

    expect(getActiveFollowCursor(candidates, 'user-2')).toEqual(
      expect.objectContaining({ userId: 'user-2', x: 320, y: 410 }),
    );
  });

  it('returns null when selected follow target is unavailable', () => {
    const candidates = buildFollowCandidates([CURSOR_BASE], 'self-user');
    expect(getActiveFollowCursor(candidates, 'missing-user')).toBeNull();
    expect(getActiveFollowCursor(candidates, null)).toBeNull();
  });
});
