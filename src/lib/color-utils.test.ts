import { describe, expect, it } from 'vitest';
import { safeColor, isValidHex, normalizeHex } from './color-utils';

describe('safeColor', () => {
  it('returns valid 6-digit hex unchanged', () => {
    expect(safeColor('#FF5733')).toBe('#FF5733');
  });

  it('returns valid 3-digit hex unchanged', () => {
    expect(safeColor('#ABC')).toBe('#ABC');
  });

  it('returns fallback for undefined', () => {
    expect(safeColor(undefined)).toBe('#64748b');
  });

  it('returns fallback for empty string', () => {
    expect(safeColor('')).toBe('#64748b');
  });

  it('returns fallback for garbage string', () => {
    expect(safeColor('not-a-color')).toBe('#64748b');
  });

  it('returns custom fallback when provided', () => {
    expect(safeColor(undefined, '#000000')).toBe('#000000');
  });

  it('trims whitespace', () => {
    expect(safeColor('  #AABBCC  ')).toBe('#AABBCC');
  });
});

describe('isValidHex', () => {
  it('returns true for valid 6-digit hex', () => {
    expect(isValidHex('#FF5733')).toBe(true);
  });

  it('returns true for valid 3-digit hex', () => {
    expect(isValidHex('#ABC')).toBe(true);
  });

  it('returns true for lowercase hex', () => {
    expect(isValidHex('#aabbcc')).toBe(true);
  });

  it('returns false for missing hash', () => {
    expect(isValidHex('FF5733')).toBe(false);
  });

  it('returns false for invalid characters', () => {
    expect(isValidHex('#GGHHII')).toBe(false);
  });

  it('returns false for wrong length', () => {
    expect(isValidHex('#AABB')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidHex('')).toBe(false);
  });
});

describe('normalizeHex', () => {
  it('adds # prefix if missing', () => {
    expect(normalizeHex('FF5733')).toBe('#FF5733');
  });

  it('expands 3-digit to 6-digit', () => {
    expect(normalizeHex('#ABC')).toBe('#AABBCC');
  });

  it('expands 3-digit without hash to 6-digit with hash', () => {
    expect(normalizeHex('ABC')).toBe('#AABBCC');
  });

  it('leaves 6-digit hex with hash unchanged', () => {
    expect(normalizeHex('#FF5733')).toBe('#FF5733');
  });

  it('trims whitespace', () => {
    expect(normalizeHex('  #FF5733  ')).toBe('#FF5733');
  });
});
