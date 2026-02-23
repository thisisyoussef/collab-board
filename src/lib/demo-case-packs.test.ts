import { describe, expect, it } from 'vitest';
import { evaluateClaimStrength } from './litigation-graph';
import { buildDemoCasePack } from './demo-case-packs';

function createDeterministicIdFactory(prefix: string) {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}-${counter}`;
  };
}

describe('demo-case-packs', () => {
  it('builds deterministic PI pack blueprints with stable structure', () => {
    const buildA = buildDemoCasePack({
      pack: 'pi',
      center: { x: 1200, y: 800 },
      actorUserId: 'user-1',
      nowIso: '2026-02-23T00:00:00.000Z',
      createId: createDeterministicIdFactory('pi'),
    });
    const buildB = buildDemoCasePack({
      pack: 'pi',
      center: { x: 1200, y: 800 },
      actorUserId: 'user-1',
      nowIso: '2026-02-23T00:00:00.000Z',
      createId: createDeterministicIdFactory('pi'),
    });

    expect(buildA).toEqual(buildB);
    expect(buildA.objects.length).toBeGreaterThan(6);
    expect(buildA.focusClaimId).toMatch(/^pi-\d+$/);
  });

  it('ships all case packs with at least one strong, medium, and weak claim', () => {
    const packs = ['pi', 'employment', 'criminal'] as const;

    packs.forEach((pack) => {
      const blueprint = buildDemoCasePack({
        pack,
        center: { x: 900, y: 640 },
        actorUserId: 'user-42',
        nowIso: '2026-02-23T00:00:00.000Z',
        createId: createDeterministicIdFactory(pack),
      });
      const results = evaluateClaimStrength(blueprint.objects);
      const levels = new Set(results.map((entry) => entry.level));

      expect(results.length).toBeGreaterThanOrEqual(3);
      expect(levels.has('strong')).toBe(true);
      expect(levels.has('medium')).toBe(true);
      expect(levels.has('weak')).toBe(true);
    });
  });
});

