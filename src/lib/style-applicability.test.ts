import { describe, expect, it } from 'vitest';
import { isApplicable, isApplicableToAll, COLOR_SWATCHES } from './style-applicability';

describe('isApplicable', () => {
  // Fill color
  it.each(['sticky', 'rect', 'circle', 'text', 'frame'] as const)(
    'fillColor applies to %s',
    (type) => {
      expect(isApplicable('fillColor', type)).toBe(true);
    },
  );

  it.each(['line', 'connector'] as const)('fillColor does NOT apply to %s', (type) => {
    expect(isApplicable('fillColor', type)).toBe(false);
  });

  // Stroke color
  it.each(['rect', 'circle', 'line', 'frame', 'connector'] as const)(
    'strokeColor applies to %s',
    (type) => {
      expect(isApplicable('strokeColor', type)).toBe(true);
    },
  );

  it.each(['sticky', 'text'] as const)('strokeColor does NOT apply to %s', (type) => {
    expect(isApplicable('strokeColor', type)).toBe(false);
  });

  // Stroke width
  it.each(['rect', 'circle', 'line', 'frame', 'connector'] as const)(
    'strokeWidth applies to %s',
    (type) => {
      expect(isApplicable('strokeWidth', type)).toBe(true);
    },
  );

  it.each(['sticky', 'text'] as const)('strokeWidth does NOT apply to %s', (type) => {
    expect(isApplicable('strokeWidth', type)).toBe(false);
  });

  // Font size
  it.each(['sticky', 'text'] as const)('fontSize applies to %s', (type) => {
    expect(isApplicable('fontSize', type)).toBe(true);
  });

  it.each(['rect', 'circle', 'line', 'frame', 'connector'] as const)(
    'fontSize does NOT apply to %s',
    (type) => {
      expect(isApplicable('fontSize', type)).toBe(false);
    },
  );
});

describe('isApplicableToAll', () => {
  it('returns true when all types match', () => {
    expect(isApplicableToAll('fillColor', ['sticky', 'rect', 'circle'])).toBe(true);
  });

  it('returns false when any type does not match', () => {
    expect(isApplicableToAll('fillColor', ['sticky', 'line'])).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(isApplicableToAll('fillColor', [])).toBe(false);
  });

  it('returns true for single matching type', () => {
    expect(isApplicableToAll('strokeColor', ['connector'])).toBe(true);
  });

  it('returns false for single non-matching type', () => {
    expect(isApplicableToAll('fontSize', ['rect'])).toBe(false);
  });
});

describe('COLOR_SWATCHES', () => {
  it('has 12 colors', () => {
    expect(COLOR_SWATCHES).toHaveLength(12);
  });

  it('all entries are valid hex colors', () => {
    for (const color of COLOR_SWATCHES) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
