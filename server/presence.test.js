import { describe, expect, it } from 'vitest';
import {
  boardRoom,
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
});
