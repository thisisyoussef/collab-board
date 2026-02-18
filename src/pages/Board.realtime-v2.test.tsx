import { describe, expect, it } from 'vitest';
import {
  applyIncomingObjectUpsert,
  createDefaultObject,
  resolveConnectorPoints,
  type ApplyIncomingObjectInput,
} from '../lib/board-object';
import type { BoardObject } from '../types/board';

describe('Board realtime v2 helpers', () => {
  it('applies newer incoming updates and rejects stale ones', () => {
    const local = createDefaultObject('rect', {
      id: 'shape-1',
      x: 10,
      y: 20,
      width: 120,
      height: 80,
      updatedAt: '2026-02-18T10:00:00.000Z',
      createdBy: 'u1',
      zIndex: 1,
    }) as BoardObject;

    const staleIncoming = {
      ...local,
      x: 18,
      updatedAt: '2026-02-18T09:59:00.000Z',
    };
    const freshIncoming = {
      ...local,
      x: 28,
      updatedAt: '2026-02-18T10:01:00.000Z',
    };

    const staleResult = applyIncomingObjectUpsert({
      existing: local,
      incoming: staleIncoming,
      eventTs: Date.parse(staleIncoming.updatedAt),
    } satisfies ApplyIncomingObjectInput);

    const freshResult = applyIncomingObjectUpsert({
      existing: local,
      incoming: freshIncoming,
      eventTs: Date.parse(freshIncoming.updatedAt),
    } satisfies ApplyIncomingObjectInput);

    expect(staleResult.shouldApply).toBe(false);
    expect(freshResult.shouldApply).toBe(true);
  });

  it('resolves connector points from linked object centers', () => {
    const from = createDefaultObject('rect', {
      id: 'from',
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      createdBy: 'u1',
      zIndex: 1,
    }) as BoardObject;

    const to = createDefaultObject('circle', {
      id: 'to',
      x: 400,
      y: 220,
      width: 120,
      height: 120,
      createdBy: 'u1',
      zIndex: 2,
    }) as BoardObject;

    const points = resolveConnectorPoints({
      from,
      to,
      fallback: [0, 0, 10, 10],
    });

    expect(points[0]).toBeCloseTo(160, 0);
    expect(points[1]).toBeCloseTo(140, 0);
    expect(points[2]).toBeCloseTo(460, 0);
    expect(points[3]).toBeCloseTo(280, 0);
  });

  it('resolves connector points from linked object anchors when provided', () => {
    const from = createDefaultObject('rect', {
      id: 'from-anchored',
      x: 100,
      y: 100,
      width: 200,
      height: 120,
      createdBy: 'u1',
      zIndex: 1,
    }) as BoardObject;

    const to = createDefaultObject('rect', {
      id: 'to-anchored',
      x: 500,
      y: 120,
      width: 160,
      height: 140,
      createdBy: 'u1',
      zIndex: 2,
    }) as BoardObject;

    const points = resolveConnectorPoints({
      from,
      to,
      fromAnchorX: 1,
      fromAnchorY: 0.5,
      toAnchorX: 0,
      toAnchorY: 0.5,
      fallback: [0, 0, 0, 0],
    });

    expect(points).toEqual([300, 160, 500, 190]);
  });
});
