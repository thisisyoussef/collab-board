import { describe, expect, it } from 'vitest';
import { applyIncomingObjectUpsert, createDefaultObject } from '../lib/board-object';
import {
  buildRealtimeEventSignature,
  createRealtimeDedupeCache,
} from '../lib/realtime-dedupe';
import type { BoardObject } from '../types/board';
import type { ObjectUpdatePayload } from '../types/realtime';

describe('Board AI realtime consistency helpers', () => {
  it('drops duplicate realtime events using tx-aware signatures', () => {
    const cache = createRealtimeDedupeCache();
    const signature = buildRealtimeEventSignature({
      eventType: 'object:update',
      boardId: 'board-1',
      objectId: 'shape-1',
      txId: 'tx-1',
      source: 'ai',
      actorUserId: 'u1',
      ts: 123,
    });

    expect(signature).toBeTruthy();
    expect(cache.markIfNew(signature || '')).toBe(true);
    expect(cache.markIfNew(signature || '')).toBe(false);
  });

  it('rejects stale updates by updatedAt timestamp', () => {
    const local = createDefaultObject('rect', {
      id: 'rect-1',
      x: 100,
      y: 100,
      width: 180,
      height: 120,
      updatedAt: '2026-02-18T10:02:00.000Z',
      createdBy: 'u-local',
      zIndex: 1,
    }) as BoardObject;

    const staleIncoming = createDefaultObject('rect', {
      ...local,
      x: 220,
      updatedAt: '2026-02-18T10:01:00.000Z',
    }) as BoardObject;

    const result = applyIncomingObjectUpsert({
      existing: local,
      incoming: staleIncoming,
      eventTs: Date.parse(staleIncoming.updatedAt),
    });

    expect(result.shouldApply).toBe(false);
  });

  it('converges to last-write-wins state for concurrent AI updates', () => {
    const base = createDefaultObject('sticky', {
      id: 'sticky-1',
      text: 'Base',
      x: 100,
      y: 120,
      updatedAt: '2026-02-18T10:00:00.000Z',
      createdBy: 'owner',
      zIndex: 1,
    }) as BoardObject;

    const updateA: ObjectUpdatePayload = {
      boardId: 'board-2',
      object: createDefaultObject('sticky', {
        ...base,
        text: 'From AI A',
        updatedAt: '2026-02-18T10:00:01.000Z',
      }),
      _ts: Date.parse('2026-02-18T10:00:01.000Z'),
      txId: 'tx-a',
      source: 'ai',
      actorUserId: 'u-a',
    };

    const updateB: ObjectUpdatePayload = {
      boardId: 'board-2',
      object: createDefaultObject('sticky', {
        ...base,
        text: 'From AI B',
        updatedAt: '2026-02-18T10:00:02.000Z',
      }),
      _ts: Date.parse('2026-02-18T10:00:02.000Z'),
      txId: 'tx-b',
      source: 'ai',
      actorUserId: 'u-b',
    };

    let current = base;

    const decisionA = applyIncomingObjectUpsert({
      existing: current,
      incoming: updateA.object,
      eventTs: updateA._ts,
    });
    if (decisionA.shouldApply) {
      current = updateA.object;
    }

    const decisionB = applyIncomingObjectUpsert({
      existing: current,
      incoming: updateB.object,
      eventTs: updateB._ts,
    });
    if (decisionB.shouldApply) {
      current = updateB.object;
    }

    expect(current.text).toBe('From AI B');
    expect(current.updatedAt).toBe('2026-02-18T10:00:02.000Z');
  });
});
