import { describe, expect, it } from 'vitest';
import { generateStressObjects } from './perf-stress';
import { MAX_OBJECT_CAPACITY } from './board-constants';

describe('generateStressObjects', () => {
  it('generates the exact count of objects requested', () => {
    const record = generateStressObjects(MAX_OBJECT_CAPACITY);
    expect(Object.keys(record)).toHaveLength(MAX_OBJECT_CAPACITY);
  });

  it('assigns unique IDs to every object', () => {
    const record = generateStressObjects(100);
    const ids = Object.keys(record);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(100);
  });

  it('creates objects with valid type, position, and dimensions', () => {
    const record = generateStressObjects(50);
    const objects = Object.values(record);

    for (const obj of objects) {
      expect(['sticky', 'rect', 'circle']).toContain(obj.type);
      expect(obj.x).toBeGreaterThanOrEqual(0);
      expect(obj.y).toBeGreaterThanOrEqual(0);
      expect(obj.width).toBeGreaterThan(0);
      expect(obj.height).toBeGreaterThan(0);
    }
  });

  it('respects custom spread parameter', () => {
    const record = generateStressObjects(100, { spread: 2000 });
    const objects = Object.values(record);

    for (const obj of objects) {
      expect(obj.x).toBeLessThan(2100); // spread + small padding
      expect(obj.y).toBeLessThan(2100);
    }
  });

  it('produces deterministic positions for repeatable tests', () => {
    const first = generateStressObjects(10);
    const second = generateStressObjects(10);

    Object.keys(first).forEach((id) => {
      expect(first[id]?.x).toBe(second[id]?.x);
      expect(first[id]?.y).toBe(second[id]?.y);
    });
  });
});
