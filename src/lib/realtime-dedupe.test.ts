import { describe, expect, it } from 'vitest';
import { buildRealtimeEventSignature, createRealtimeDedupeCache } from './realtime-dedupe';

describe('realtime-dedupe', () => {
  it('accepts first event and rejects exact duplicate while TTL is active', () => {
    let now = 1_000;
    const cache = createRealtimeDedupeCache({
      ttlMs: 5_000,
      nowMs: () => now,
    });

    const signature = buildRealtimeEventSignature({
      eventType: 'object:update',
      boardId: 'board-1',
      objectId: 'shape-1',
      txId: 'tx-1',
      source: 'ai',
      actorUserId: 'u1',
      ts: now,
    });

    expect(signature).toBeTruthy();
    expect(cache.markIfNew(signature || '')).toBe(true);
    expect(cache.markIfNew(signature || '')).toBe(false);

    now += 1_000;
    expect(cache.markIfNew(signature || '')).toBe(false);
  });

  it('allows same event signature again after TTL expiry', () => {
    let now = 10_000;
    const cache = createRealtimeDedupeCache({
      ttlMs: 200,
      nowMs: () => now,
    });

    const signature = buildRealtimeEventSignature({
      eventType: 'object:create',
      boardId: 'board-2',
      objectId: 'shape-2',
      txId: 'tx-2',
      source: 'ai',
      actorUserId: 'u2',
      ts: now,
    });

    expect(cache.markIfNew(signature || '')).toBe(true);
    now += 250;
    expect(cache.markIfNew(signature || '')).toBe(true);
  });

  it('builds null signature when required fields are missing', () => {
    const signature = buildRealtimeEventSignature({
      eventType: 'object:delete',
      boardId: '',
      objectId: 'shape-3',
      ts: 123,
    });

    expect(signature).toBeNull();
  });
});
