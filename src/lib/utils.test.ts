import { describe, expect, it } from 'vitest';
import { generateColor, getInitials } from './utils';

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
