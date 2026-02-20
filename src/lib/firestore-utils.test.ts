import { describe, expect, it } from 'vitest';
import { toMillis } from './firestore-utils';

describe('toMillis', () => {
  it('returns milliseconds from a Firestore Timestamp-like object', () => {
    const fakeTimestamp = { toMillis: () => 1700000000000 };
    expect(toMillis(fakeTimestamp)).toBe(1700000000000);
  });

  it('returns 0 for null', () => {
    expect(toMillis(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(toMillis(undefined)).toBe(0);
  });

  it('returns 0 for a plain number', () => {
    expect(toMillis(42)).toBe(0);
  });

  it('returns 0 for a string', () => {
    expect(toMillis('2026-02-19')).toBe(0);
  });

  it('returns 0 for an object without toMillis', () => {
    expect(toMillis({ seconds: 100 })).toBe(0);
  });

  it('returns 0 for an object where toMillis is not a function', () => {
    expect(toMillis({ toMillis: 'not-a-function' })).toBe(0);
  });

  it('returns 0 when toMillis() returns null/undefined', () => {
    const fakeTimestamp = { toMillis: () => null };
    expect(toMillis(fakeTimestamp as unknown)).toBe(0);
  });
});
