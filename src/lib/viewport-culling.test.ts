import { describe, expect, it } from 'vitest';
import { getVisibleObjects } from './viewport-culling';
import type { Bounds } from './viewport-culling';

// Helper: default viewport is 1000×800px, stage at origin, scale 1.
const defaultViewport = { width: 1000, height: 800 };
const originPos = { x: 0, y: 0 };

function box(x: number, y: number, w = 100, h = 80): Bounds {
  return { x, y, width: w, height: h };
}

describe('getVisibleObjects', () => {
  it('includes objects fully inside the viewport', () => {
    const objects = [box(100, 100), box(500, 400)];
    const result = getVisibleObjects(objects, originPos, 1, defaultViewport);
    expect(result).toHaveLength(2);
  });

  it('excludes objects fully outside the viewport', () => {
    const objects = [
      box(1200, 100),  // right of viewport
      box(-300, 100),  // left of viewport (entirely)
      box(100, 1000),  // below viewport
      box(100, -200),  // above viewport (entirely)
    ];
    const result = getVisibleObjects(objects, originPos, 1, defaultViewport);
    expect(result).toHaveLength(0);
  });

  it('includes objects partially overlapping the viewport', () => {
    const objects = [
      box(950, 400, 200, 80), // overlaps right edge
      box(-50, 400, 100, 80), // overlaps left edge
    ];
    const result = getVisibleObjects(objects, originPos, 1, defaultViewport);
    expect(result).toHaveLength(2);
  });

  it('includes edge-touching objects (at viewport boundary)', () => {
    // Object at x=0 with width=100 ends at x=100 — inside viewport
    const objects = [box(0, 0, 100, 80)];
    const result = getVisibleObjects(objects, originPos, 1, defaultViewport);
    expect(result).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    const result = getVisibleObjects([], originPos, 1, defaultViewport);
    expect(result).toHaveLength(0);
  });

  it('correctly adjusts bounds when scale factor changes', () => {
    // At scale 2, viewport covers world area 500×400 (half the pixels)
    const objects = [
      box(400, 300),  // inside at scale 2 (within 500×400)
      box(600, 100),  // outside at scale 2 (x=600 > 500)
    ];
    const result = getVisibleObjects(objects, originPos, 2, defaultViewport);
    expect(result).toHaveLength(1);
    expect(result[0]?.x).toBe(400);
  });

  it('handles panned stage position correctly', () => {
    // Stage panned left by 500px at scale 1 → world view starts at x=500
    const panPos = { x: -500, y: 0 };
    const objects = [
      box(100, 100),  // at world x=100, now left of viewport (viewport starts at 500)
      box(600, 100),  // at world x=600, inside viewport (500 to 1500)
    ];
    const result = getVisibleObjects(objects, panPos, 1, defaultViewport);
    expect(result).toHaveLength(1);
    expect(result[0]?.x).toBe(600);
  });

  it('handles zero or negative scale gracefully', () => {
    const objects = [box(100, 100)];
    expect(getVisibleObjects(objects, originPos, 0, defaultViewport)).toHaveLength(0);
    expect(getVisibleObjects(objects, originPos, -1, defaultViewport)).toHaveLength(0);
  });
});
