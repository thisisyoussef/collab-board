import { describe, expect, it } from 'vitest';
import {
  clampObjectDimensions,
  createDefaultObject,
  getObjectAnchorCandidates,
  normalizeLoadedObject,
  projectPointToObjectPerimeter,
  resolveObjectAnchorPoint,
  resolveConnectorPoints,
  sanitizeBoardObjectForFirestore,
  type DefaultBoardObjectFactory,
} from './board-object';
import type { BoardObject } from '../types/board';

function createFactoryBase(overrides: Partial<DefaultBoardObjectFactory> = {}): DefaultBoardObjectFactory {
  return {
    createdBy: 'user-1',
    nowIso: '2026-02-18T00:00:00.000Z',
    nextZIndex: 3,
    ...overrides,
  };
}

describe('board-object normalize/sanitize', () => {
  it('normalizes all supported primitive types', () => {
    const fallbackUserId = 'guest-user';
    const rawObjects: unknown[] = [
      { id: 'a', type: 'sticky', x: 10, y: 20, text: 'A', width: 120, height: 80 },
      { id: 'b', type: 'rect', x: 10, y: 20, width: 120, height: 80 },
      { id: 'c', type: 'circle', x: 10, y: 20, width: 120, height: 80 },
      { id: 'd', type: 'line', x: 10, y: 20, points: [0, 0, 50, 30], width: 50, height: 30 },
      { id: 'e', type: 'text', x: 10, y: 20, text: 'Label', width: 160, height: 40 },
      { id: 'f', type: 'frame', x: 10, y: 20, width: 320, height: 240, title: 'Frame A' },
      {
        id: 'g',
        type: 'connector',
        x: 10,
        y: 20,
        width: 90,
        height: 20,
        fromId: 'a',
        toId: 'b',
        points: [0, 0, 90, 20],
      },
    ];

    const normalized = rawObjects
      .map((entry) => normalizeLoadedObject(entry, fallbackUserId))
      .filter((entry): entry is BoardObject => Boolean(entry));

    expect(normalized).toHaveLength(7);
    expect(normalized.map((entry) => entry.type)).toEqual([
      'sticky',
      'rect',
      'circle',
      'line',
      'text',
      'frame',
      'connector',
    ]);
  });

  it('rejects malformed object types', () => {
    expect(normalizeLoadedObject({ type: 'triangle' }, 'guest')).toBeNull();
    expect(normalizeLoadedObject(null, 'guest')).toBeNull();
    expect(normalizeLoadedObject('x', 'guest')).toBeNull();
  });

  it('sanitizes new primitives for Firestore transport', () => {
    const base = createFactoryBase();
    const raw = [
      clampObjectDimensions({ id: '1', type: 'circle', x: 0, y: 0, width: 120, height: 120 }, base),
      clampObjectDimensions(
        { id: '2', type: 'line', x: 0, y: 0, width: 80, height: 20, points: [0, 0, 80, 20] },
        base,
      ),
      clampObjectDimensions({ id: '3', type: 'text', x: 0, y: 0, text: 'Text', width: 200, height: 48 }, base),
      clampObjectDimensions(
        { id: '4', type: 'frame', x: 0, y: 0, width: 360, height: 240, title: 'Group 1' },
        base,
      ),
      clampObjectDimensions(
        {
          id: '5',
          type: 'connector',
          x: 0,
          y: 0,
          width: 120,
          height: 40,
          fromId: '1',
          toId: '3',
          fromAnchorX: 1,
          fromAnchorY: 0.5,
          toAnchorX: 0,
          toAnchorY: 0.25,
          points: [0, 0, 120, 40],
        },
        base,
      ),
    ];

    const sanitized = raw.map((entry) => sanitizeBoardObjectForFirestore(entry));
    expect(sanitized).toHaveLength(5);
    expect(sanitized.every((entry) => typeof entry.updatedAt === 'string')).toBe(true);
    expect(sanitized[4].fromAnchorX).toBe(1);
    expect(sanitized[4].toAnchorY).toBe(0.25);
  });

  it('removes undefined fields from sanitized connector payloads', () => {
    const connector = createDefaultObject('connector', {
      id: 'connector-undefined',
      createdBy: 'u1',
      zIndex: 1,
      fromId: '',
      toId: '',
      fromAnchorX: undefined,
      fromAnchorY: undefined,
      toAnchorX: undefined,
      toAnchorY: undefined,
      label: undefined,
      pathControlX: undefined,
      pathControlY: undefined,
    });

    const sanitized = sanitizeBoardObjectForFirestore(connector) as Record<string, unknown>;
    expect('fromAnchorX' in sanitized).toBe(false);
    expect('fromAnchorY' in sanitized).toBe(false);
    expect('toAnchorX' in sanitized).toBe(false);
    expect('toAnchorY' in sanitized).toBe(false);
    expect('label' in sanitized).toBe(false);
    expect('pathControlX' in sanitized).toBe(false);
    expect('pathControlY' in sanitized).toBe(false);
  });

  it('projects attachment points to rectangle and circle perimeters', () => {
    const rect = createDefaultObject('rect', {
      id: 'rect-1',
      x: 100,
      y: 100,
      width: 200,
      height: 120,
      createdBy: 'u1',
      zIndex: 1,
    });
    const circle = createDefaultObject('circle', {
      id: 'circle-1',
      x: 300,
      y: 220,
      width: 120,
      height: 120,
      createdBy: 'u1',
      zIndex: 2,
    });

    const rectAttachment = projectPointToObjectPerimeter(rect, { x: 420, y: 180 });
    expect(rectAttachment.x).toBeCloseTo(300, 0);
    expect(rectAttachment.y).toBeCloseTo(180, 0);
    expect(rectAttachment.anchorX).toBeCloseTo(1, 2);

    const circleAttachment = projectPointToObjectPerimeter(circle, { x: 500, y: 280 });
    expect(circleAttachment.x).toBeCloseTo(420, 0);
    expect(circleAttachment.anchorX).toBeGreaterThan(0.5);
    expect(circleAttachment.anchorY).toBeCloseTo(0.5, 1);
  });

  it('resolves connector points with endpoint anchors when links exist', () => {
    const from = createDefaultObject('rect', {
      id: 'from',
      x: 100,
      y: 100,
      width: 200,
      height: 120,
      createdBy: 'u1',
      zIndex: 1,
    });
    const to = createDefaultObject('circle', {
      id: 'to',
      x: 500,
      y: 120,
      width: 120,
      height: 120,
      createdBy: 'u1',
      zIndex: 2,
    });

    const points = resolveConnectorPoints({
      from,
      to,
      fromAnchorX: 1,
      fromAnchorY: 0.5,
      toAnchorX: 0,
      toAnchorY: 0.5,
      fallback: [0, 0, 0, 0],
    });

    expect(points).toEqual([300, 160, 500, 180]);
  });

  it('normalizes connector v2 defaults for path, stroke, and arrowheads', () => {
    const connector = createDefaultObject('connector', {
      id: 'connector-v2',
      x: 0,
      y: 0,
      createdBy: 'u1',
      zIndex: 1,
    });

    expect(connector.connectorType).toBe('straight');
    expect(connector.strokeStyle).toBe('solid');
    expect(connector.startArrow).toBe('none');
    expect(connector.endArrow).toBe('solid');
    expect(connector.labelPosition).toBe(50);
    expect(connector.labelBackground).toBe(false);
  });

  it('applies brand-aligned default colors across object types', () => {
    const sticky = createDefaultObject('sticky', { id: 'sticky-brand' });
    const rect = createDefaultObject('rect', { id: 'rect-brand' });
    const circle = createDefaultObject('circle', { id: 'circle-brand' });
    const line = createDefaultObject('line', { id: 'line-brand' });
    const text = createDefaultObject('text', { id: 'text-brand' });
    const frame = createDefaultObject('frame', { id: 'frame-brand' });
    const connector = createDefaultObject('connector', { id: 'connector-brand' });

    expect(sticky.color).toBe('#F5D08E');
    expect(rect.color).toBe('#FAFAF8');
    expect(rect.stroke).toBe('#2A4A7F');
    expect(circle.color).toBe('#F2F0EB');
    expect(circle.stroke).toBe('#2A4A7F');
    expect(line.color).toBe('#2A4A7F');
    expect(text.color).toBe('#1E1C19');
    expect(frame.color).toBe('#F2F0EB');
    expect(frame.stroke).toBe('#132D54');
    expect(connector.color).toBe('#4A8FCC');
  });

  it('resolves bent connector path around obstacles', () => {
    const points = resolveConnectorPoints({
      from: undefined,
      to: undefined,
      connectorType: 'bent',
      obstacles: [{ x: 180, y: 120, width: 140, height: 120 }],
      fallback: [120, 180, 420, 180],
    });

    expect(points.length).toBeGreaterThanOrEqual(6);
    expect(points[0]).toBe(120);
    expect(points[1]).toBe(180);
    expect(points[points.length - 2]).toBe(420);
    expect(points[points.length - 1]).toBe(180);
  });

  it('resolves curved connector path with control point overrides', () => {
    const points = resolveConnectorPoints({
      from: undefined,
      to: undefined,
      connectorType: 'curved',
      pathControlX: 220,
      pathControlY: 40,
      fallback: [100, 100, 300, 100],
    });

    expect(points).toHaveLength(8);
    expect(points[0]).toBe(100);
    expect(points[1]).toBe(100);
    expect(points[6]).toBe(300);
    expect(points[7]).toBe(100);
  });

  it('keeps circles normalized and exposes anchor candidates', () => {
    const circle = createDefaultObject('circle', {
      id: 'circle-anchors',
      x: 200,
      y: 150,
      width: 140,
      height: 80,
      createdBy: 'u1',
      zIndex: 1,
    });

    expect(circle.width).toBe(circle.height);
    expect(circle.width).toBe(140);

    const anchors = getObjectAnchorCandidates(circle);
    expect(anchors).toHaveLength(8);
    const east = anchors.find((entry) => entry.anchorX === 1 && entry.anchorY === 0.5);
    expect(east).toBeDefined();
    expect(east?.x).toBeCloseTo(340, 0);
    expect(east?.y).toBeCloseTo(220, 0);
  });

  it('resolves object anchor positions from normalized coordinates', () => {
    const rect = createDefaultObject('rect', {
      id: 'rect-anchor-position',
      x: 50,
      y: 75,
      width: 200,
      height: 100,
      createdBy: 'u1',
      zIndex: 1,
    });

    const point = resolveObjectAnchorPoint(rect, 1, 0.5);
    expect(point).toEqual({ x: 250, y: 125 });
  });
});
