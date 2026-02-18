import { describe, expect, it } from 'vitest';
import { generateColor, getInitials, screenToWorld, worldToScreen } from './utils';

describe('generateColor', () => {
  it('returns deterministic colors for the same user', () => {
    expect(generateColor('user-123')).toBe(generateColor('user-123'));
  });

  it('returns hsl color values', () => {
    expect(generateColor('user-123')).toMatch(/^hsl\(\d+, 65%, 55%\)$/);
  });
});

describe('getInitials', () => {
  it('returns two initials for first and last name', () => {
    expect(getInitials('Alex Johnson')).toBe('AJ');
  });

  it('returns first two characters for email addresses', () => {
    expect(getInitials('sam@example.com')).toBe('SA');
  });

  it('returns fallback for empty input', () => {
    expect(getInitials('   ')).toBe('??');
  });
});

describe('coordinate transforms', () => {
  const stage = {
    x: () => 50,
    y: () => 40,
    scaleX: () => 2,
  };

  it('converts screen to world coordinates', () => {
    expect(screenToWorld(stage, { x: 250, y: 140 })).toEqual({ x: 100, y: 50 });
  });

  it('converts world to screen coordinates', () => {
    expect(worldToScreen(stage, { x: 100, y: 50 })).toEqual({ x: 250, y: 140 });
  });
});
