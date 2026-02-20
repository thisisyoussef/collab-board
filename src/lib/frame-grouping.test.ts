import { describe, expect, it } from 'vitest';
import type { BoardObject } from '../types/board';
import {
  isContainedInFrame,
  getFrameChildren,
  computeFrameMembership,
  applyFrameDelta,
  findFrameAtPoint,
} from './frame-grouping';

function makeObject(overrides: Partial<BoardObject> & { id: string; type: BoardObject['type'] }): BoardObject {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    rotation: 0,
    color: '#e2e8f0',
    zIndex: 1,
    createdBy: 'user-1',
    updatedAt: '2026-02-20T00:00:00.000Z',
    ...overrides,
  };
}

const frame1 = makeObject({ id: 'frame-1', type: 'frame', x: 0, y: 0, width: 400, height: 300 });

describe('isContainedInFrame', () => {
  it('returns true when object center is inside frame bounds', () => {
    const obj = makeObject({ id: 'obj-1', type: 'sticky', x: 100, y: 100, width: 60, height: 40 });
    // center = (130, 120) — inside (0,0)-(400,300)
    expect(isContainedInFrame(obj, frame1)).toBe(true);
  });

  it('returns false when object center is outside frame bounds', () => {
    const obj = makeObject({ id: 'obj-2', type: 'sticky', x: 500, y: 500, width: 60, height: 40 });
    // center = (530, 520) — outside
    expect(isContainedInFrame(obj, frame1)).toBe(false);
  });

  it('returns true when object center is exactly on frame boundary', () => {
    // Frame is 0,0 to 400,300. Object center at exactly (400, 150) — on right edge
    const obj = makeObject({ id: 'obj-3', type: 'rect', x: 370, y: 130, width: 60, height: 40 });
    // center = (400, 150) — exactly on right edge, should be inclusive
    expect(isContainedInFrame(obj, frame1)).toBe(true);
  });

  it('returns false when object overlaps frame but center is outside', () => {
    const obj = makeObject({ id: 'obj-4', type: 'rect', x: 380, y: 100, width: 100, height: 80 });
    // center = (430, 140) — outside frame despite visual overlap
    expect(isContainedInFrame(obj, frame1)).toBe(false);
  });

  it('handles zero-dimension objects (point at x,y)', () => {
    const obj = makeObject({ id: 'obj-5', type: 'text', x: 200, y: 150, width: 0, height: 0 });
    // center = (200, 150) — inside frame
    expect(isContainedInFrame(obj, frame1)).toBe(true);
  });
});

describe('getFrameChildren', () => {
  it('returns IDs of objects whose center is inside the frame', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('frame-1', frame1);
    objects.set('inside-1', makeObject({ id: 'inside-1', type: 'sticky', x: 50, y: 50, width: 60, height: 40 }));
    objects.set('inside-2', makeObject({ id: 'inside-2', type: 'rect', x: 200, y: 100, width: 80, height: 60 }));
    objects.set('outside-1', makeObject({ id: 'outside-1', type: 'sticky', x: 500, y: 500, width: 60, height: 40 }));

    const children = getFrameChildren(frame1, objects);
    expect(children).toContain('inside-1');
    expect(children).toContain('inside-2');
    expect(children).not.toContain('outside-1');
    expect(children).toHaveLength(2);
  });

  it('excludes the frame itself', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('frame-1', frame1);

    const children = getFrameChildren(frame1, objects);
    expect(children).not.toContain('frame-1');
  });

  it('excludes other frames (no nesting)', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('frame-1', frame1);
    objects.set('frame-2', makeObject({ id: 'frame-2', type: 'frame', x: 50, y: 50, width: 200, height: 150 }));

    const children = getFrameChildren(frame1, objects);
    expect(children).not.toContain('frame-2');
  });

  it('excludes connectors', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('frame-1', frame1);
    objects.set('conn-1', makeObject({ id: 'conn-1', type: 'connector', x: 100, y: 100, width: 80, height: 0 }));

    const children = getFrameChildren(frame1, objects);
    expect(children).not.toContain('conn-1');
  });

  it('returns empty array when no objects are inside', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('frame-1', frame1);
    objects.set('far-away', makeObject({ id: 'far-away', type: 'sticky', x: 1000, y: 1000, width: 60, height: 40 }));

    expect(getFrameChildren(frame1, objects)).toEqual([]);
  });
});

describe('computeFrameMembership', () => {
  it('returns correct membership for multiple frames', () => {
    const objects = new Map<string, BoardObject>();
    const frameA = makeObject({ id: 'fA', type: 'frame', x: 0, y: 0, width: 200, height: 200 });
    const frameB = makeObject({ id: 'fB', type: 'frame', x: 500, y: 500, width: 200, height: 200 });
    objects.set('fA', frameA);
    objects.set('fB', frameB);
    objects.set('inA', makeObject({ id: 'inA', type: 'sticky', x: 50, y: 50, width: 40, height: 30 }));
    objects.set('inB', makeObject({ id: 'inB', type: 'rect', x: 550, y: 550, width: 40, height: 30 }));
    objects.set('nowhere', makeObject({ id: 'nowhere', type: 'text', x: 900, y: 900, width: 40, height: 30 }));

    const membership = computeFrameMembership(objects);
    expect(membership.get('fA')).toEqual(['inA']);
    expect(membership.get('fB')).toEqual(['inB']);
  });

  it('assigns object to smallest frame when overlapping', () => {
    const objects = new Map<string, BoardObject>();
    const bigFrame = makeObject({ id: 'big', type: 'frame', x: 0, y: 0, width: 500, height: 500 });
    const smallFrame = makeObject({ id: 'small', type: 'frame', x: 50, y: 50, width: 100, height: 100 });
    objects.set('big', bigFrame);
    objects.set('small', smallFrame);
    // Object center at (80, 80) — inside both frames
    objects.set('obj', makeObject({ id: 'obj', type: 'sticky', x: 60, y: 60, width: 40, height: 40 }));

    const membership = computeFrameMembership(objects);
    expect(membership.get('small')).toContain('obj');
    expect(membership.get('big')).not.toContain('obj');
  });

  it('returns empty map when no frames exist', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('obj-1', makeObject({ id: 'obj-1', type: 'sticky', x: 50, y: 50, width: 40, height: 30 }));

    const membership = computeFrameMembership(objects);
    expect(membership.size).toBe(0);
  });

  it('returns empty arrays for frames with no children', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('f1', makeObject({ id: 'f1', type: 'frame', x: 0, y: 0, width: 100, height: 100 }));

    const membership = computeFrameMembership(objects);
    expect(membership.get('f1')).toEqual([]);
  });
});

describe('applyFrameDelta', () => {
  it('shifts all children by the given delta', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('c1', makeObject({ id: 'c1', type: 'sticky', x: 100, y: 200, width: 60, height: 40 }));
    objects.set('c2', makeObject({ id: 'c2', type: 'rect', x: 300, y: 400, width: 80, height: 60 }));

    const result = applyFrameDelta(['c1', 'c2'], 10, -20, objects);
    expect(result.get('c1')!.x).toBe(110);
    expect(result.get('c1')!.y).toBe(180);
    expect(result.get('c2')!.x).toBe(310);
    expect(result.get('c2')!.y).toBe(380);
  });

  it('returns empty map for empty childIds', () => {
    const objects = new Map<string, BoardObject>();
    const result = applyFrameDelta([], 10, 10, objects);
    expect(result.size).toBe(0);
  });

  it('silently skips child IDs not found in the map', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('c1', makeObject({ id: 'c1', type: 'sticky', x: 50, y: 50, width: 60, height: 40 }));

    const result = applyFrameDelta(['c1', 'missing-id'], 5, 5, objects);
    expect(result.size).toBe(1);
    expect(result.get('c1')!.x).toBe(55);
  });

  it('does not mutate the input map', () => {
    const objects = new Map<string, BoardObject>();
    const original = makeObject({ id: 'c1', type: 'sticky', x: 100, y: 100, width: 60, height: 40 });
    objects.set('c1', original);

    applyFrameDelta(['c1'], 10, 10, objects);
    expect(objects.get('c1')!.x).toBe(100);
    expect(objects.get('c1')!.y).toBe(100);
  });
});

describe('findFrameAtPoint', () => {
  it('returns the frame ID containing the point', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('f1', makeObject({ id: 'f1', type: 'frame', x: 0, y: 0, width: 300, height: 200 }));

    expect(findFrameAtPoint({ x: 150, y: 100 }, objects)).toBe('f1');
  });

  it('returns null when point is outside all frames', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('f1', makeObject({ id: 'f1', type: 'frame', x: 0, y: 0, width: 100, height: 100 }));

    expect(findFrameAtPoint({ x: 500, y: 500 }, objects)).toBeNull();
  });

  it('returns the smallest frame when point is inside overlapping frames', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('big', makeObject({ id: 'big', type: 'frame', x: 0, y: 0, width: 500, height: 500 }));
    objects.set('small', makeObject({ id: 'small', type: 'frame', x: 50, y: 50, width: 100, height: 100 }));

    expect(findFrameAtPoint({ x: 80, y: 80 }, objects)).toBe('small');
  });

  it('returns null when map has no frames', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('obj-1', makeObject({ id: 'obj-1', type: 'sticky', x: 0, y: 0, width: 100, height: 80 }));

    expect(findFrameAtPoint({ x: 50, y: 40 }, objects)).toBeNull();
  });
});
