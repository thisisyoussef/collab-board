import { describe, expect, it } from 'vitest';
import {
  boardRoom,
  buildCursorHidePayload,
  buildCursorPayload,
  buildPresenceMember,
  generateColor,
  normalizeNonEmptyString,
} from './presence.js';

describe('presence helpers', () => {
  it('normalizes non-empty strings', () => {
    expect(normalizeNonEmptyString(' board-1 ')).toBe('board-1');
    expect(normalizeNonEmptyString('')).toBeNull();
    expect(normalizeNonEmptyString(undefined)).toBeNull();
  });

  it('builds board room keys', () => {
    expect(boardRoom('abc')).toBe('board:abc');
  });

  it('creates deterministic colors', () => {
    expect(generateColor('user-1')).toBe(generateColor('user-1'));
    expect(generateColor('user-1')).toMatch(/^hsl\(\d+, 65%, 55%\)$/);
  });

  it('builds presence members from socket-like objects', () => {
    const member = buildPresenceMember({
      id: 'socket-1',
      data: {
        userId: 'user-1',
        displayName: 'Alex Johnson',
        color: 'hsl(10, 65%, 55%)',
      },
    });

    expect(member).toEqual({
      socketId: 'socket-1',
      userId: 'user-1',
      displayName: 'Alex Johnson',
      color: 'hsl(10, 65%, 55%)',
    });
  });

  it('builds cursor payloads from socket data', () => {
    const payload = buildCursorPayload(
      { x: 120, y: 240, _ts: 1_700_000_000_000 },
      {
        id: 'socket-1',
        data: {
          userId: 'user-1',
          displayName: 'Alex Johnson',
          color: 'hsl(10, 65%, 55%)',
        },
      },
    );

    expect(payload).toEqual({
      socketId: 'socket-1',
      userId: 'user-1',
      displayName: 'Alex Johnson',
      color: 'hsl(10, 65%, 55%)',
      x: 120,
      y: 240,
      _ts: 1_700_000_000_000,
    });
  });

  it('builds cursor hide payloads from socket data', () => {
    const payload = buildCursorHidePayload(
      { _ts: 1_700_000_000_000 },
      {
        id: 'socket-1',
        data: {
          userId: 'user-1',
        },
      },
    );

    expect(payload).toEqual({
      socketId: 'socket-1',
      userId: 'user-1',
      _ts: 1_700_000_000_000,
    });
  });

  it('returns null for invalid cursor coordinates', () => {
    const payload = buildCursorPayload(
      { x: 'bad', y: 20, _ts: Date.now() },
      { id: 'socket-1', data: { userId: 'user-1' } },
    );

    expect(payload).toBeNull();
  });
});
