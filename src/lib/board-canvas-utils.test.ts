import { describe, expect, it } from 'vitest';
import {
  buildBoardReturnToPath,
  estimateConnectorLabelBounds,
  filterOccludedConnectorAnchors,
  getClickShapeDefaultsForViewport,
  getStickyRenderColor,
  getStickyRenderText,
  intersects,
  isPlaceholderStickyText,
} from './board-canvas-utils';
import type { BoardObject } from '../types/board';

function makeObject(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: 'obj',
    type: 'rect',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    color: '#111827',
    zIndex: 0,
    createdBy: 'user-1',
    updatedAt: '2026-02-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('intersects', () => {
  it('returns true for overlapping rectangles', () => {
    expect(intersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  });

  it('returns false for non-overlapping rectangles', () => {
    expect(intersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 10, height: 10 })).toBe(false);
  });

  it('returns true when touching edges exactly (inclusive)', () => {
    expect(intersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 })).toBe(true);
  });

  it('returns true for fully contained rectangle', () => {
    expect(intersects({ x: 0, y: 0, width: 100, height: 100 }, { x: 10, y: 10, width: 10, height: 10 })).toBe(true);
  });
});

describe('isPlaceholderStickyText', () => {
  it('returns true for undefined', () => {
    expect(isPlaceholderStickyText(undefined)).toBe(true);
  });

  it('returns true for empty string', () => {
    expect(isPlaceholderStickyText('')).toBe(true);
  });

  it('returns true for "New note"', () => {
    expect(isPlaceholderStickyText('New note')).toBe(true);
  });

  it('returns true case-insensitively', () => {
    expect(isPlaceholderStickyText('NEW NOTE')).toBe(true);
    expect(isPlaceholderStickyText('  new note  ')).toBe(true);
  });

  it('returns false for custom text', () => {
    expect(isPlaceholderStickyText('My actual note')).toBe(false);
  });
});

describe('getStickyRenderText', () => {
  it('returns placeholder text for undefined', () => {
    expect(getStickyRenderText(undefined)).toBe('New note');
  });

  it('returns actual text for non-placeholder', () => {
    expect(getStickyRenderText('Hello')).toBe('Hello');
  });
});

describe('getStickyRenderColor', () => {
  it('returns gray for placeholder', () => {
    expect(getStickyRenderColor(undefined)).toBe('#6b7280');
  });

  it('returns dark for actual text', () => {
    expect(getStickyRenderColor('Hello')).toBe('#111827');
  });
});

describe('estimateConnectorLabelBounds', () => {
  it('returns positive dimensions for non-empty text', () => {
    const bounds = estimateConnectorLabelBounds('Hello');
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
  });

  it('returns minimum dimensions for single-char text', () => {
    const bounds = estimateConnectorLabelBounds('X');
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
  });
});

describe('getClickShapeDefaultsForViewport', () => {
  it('matches legacy click defaults at baseline viewport and 100% zoom', () => {
    expect(
      getClickShapeDefaultsForViewport({
        viewportWidth: 960,
        viewportHeight: 560,
        scale: 1,
      }),
    ).toEqual({
      rectWidth: 180,
      rectHeight: 120,
      circleSize: 120,
      lineWidth: 180,
    });
  });

  it('increases world-space defaults when zoomed out', () => {
    expect(
      getClickShapeDefaultsForViewport({
        viewportWidth: 960,
        viewportHeight: 560,
        scale: 0.5,
      }),
    ).toEqual({
      rectWidth: 360,
      rectHeight: 240,
      circleSize: 240,
      lineWidth: 360,
    });
  });

  it('decreases world-space defaults when zoomed in', () => {
    expect(
      getClickShapeDefaultsForViewport({
        viewportWidth: 960,
        viewportHeight: 560,
        scale: 2,
      }),
    ).toEqual({
      rectWidth: 90,
      rectHeight: 60,
      circleSize: 60,
      lineWidth: 90,
    });
  });

  it('falls back to legacy defaults for invalid viewport values', () => {
    expect(
      getClickShapeDefaultsForViewport({
        viewportWidth: Number.NaN,
        viewportHeight: 0,
        scale: Number.NaN,
      }),
    ).toEqual({
      rectWidth: 180,
      rectHeight: 120,
      circleSize: 120,
      lineWidth: 180,
    });
  });

  it('never returns values below minimum shape dimensions', () => {
    expect(
      getClickShapeDefaultsForViewport({
        viewportWidth: 12,
        viewportHeight: 12,
        scale: 8,
      }),
    ).toEqual({
      rectWidth: 10,
      rectHeight: 10,
      circleSize: 10,
      lineWidth: 10,
    });
  });
});

describe('buildBoardReturnToPath', () => {
  it('returns /board/:id as fallback', () => {
    expect(buildBoardReturnToPath('abc-123')).toBe('/board/abc-123');
  });
});

describe('filterOccludedConnectorAnchors', () => {
  it('keeps anchors visible when no higher object covers the point', () => {
    const target = makeObject({ id: 'target', x: 20, y: 20, width: 80, height: 60, zIndex: 1 });
    const unrelatedTop = makeObject({ id: 'top', x: 220, y: 220, width: 60, height: 60, zIndex: 2 });
    const objects = new Map<string, BoardObject>([
      [target.id, target],
      [unrelatedTop.id, unrelatedTop],
    ]);

    const anchors = [{ key: 'target-right', objectId: target.id, x: 100, y: 50, anchorX: 1, anchorY: 0.5 }];
    expect(filterOccludedConnectorAnchors(anchors, objects)).toEqual(anchors);
  });

  it('hides anchors when a higher z-order object covers the anchor point', () => {
    const target = makeObject({ id: 'target', x: 20, y: 20, width: 80, height: 60, zIndex: 1 });
    const occluder = makeObject({ id: 'occluder', x: 90, y: 20, width: 80, height: 80, zIndex: 2 });
    const objects = new Map<string, BoardObject>([
      [target.id, target],
      [occluder.id, occluder],
    ]);

    const anchors = [{ key: 'target-right', objectId: target.id, x: 100, y: 50, anchorX: 1, anchorY: 0.5 }];
    expect(filterOccludedConnectorAnchors(anchors, objects)).toEqual([]);
  });

  it('does not let frames occlude non-frame anchors even with larger z-index', () => {
    const target = makeObject({ id: 'target', x: 20, y: 20, width: 80, height: 60, zIndex: 1 });
    const frame = makeObject({
      id: 'frame-top-z',
      type: 'frame',
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      zIndex: 99,
      stroke: '#cbd5e1',
    });
    const objects = new Map<string, BoardObject>([
      [target.id, target],
      [frame.id, frame],
    ]);

    const anchors = [{ key: 'target-right', objectId: target.id, x: 100, y: 50, anchorX: 1, anchorY: 0.5 }];
    expect(filterOccludedConnectorAnchors(anchors, objects)).toEqual(anchors);
  });

  it('uses deterministic id ordering when z-index matches', () => {
    const lowerId = makeObject({ id: 'shape-a', x: 20, y: 20, width: 80, height: 60, zIndex: 1 });
    const higherId = makeObject({ id: 'shape-b', x: 90, y: 10, width: 80, height: 80, zIndex: 1 });
    const objects = new Map<string, BoardObject>([
      [lowerId.id, lowerId],
      [higherId.id, higherId],
    ]);

    const anchors = [{ key: 'shape-a-right', objectId: lowerId.id, x: 100, y: 50, anchorX: 1, anchorY: 0.5 }];
    expect(filterOccludedConnectorAnchors(anchors, objects)).toEqual([]);
  });
});
