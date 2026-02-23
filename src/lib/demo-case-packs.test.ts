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
    const packs = [
      'pi',
      'employment',
      'criminal',
      'credibility',
      'causation',
      'damages',
      'johnson',
    ] as const;

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

  it('builds Strong Case (Johnson v. TechCorp) with 9 nodes and 7 semantic connectors', () => {
    const blueprint = buildDemoCasePack({
      pack: 'johnson',
      center: { x: 1100, y: 760 },
      actorUserId: 'user-99',
      nowIso: '2026-02-23T00:00:00.000Z',
      createId: createDeterministicIdFactory('johnson'),
    });

    const nodes = blueprint.objects.filter((entry) => entry.type !== 'connector');
    const connectors = blueprint.objects.filter((entry) => entry.type === 'connector');

    expect(nodes).toHaveLength(9);
    expect(connectors).toHaveLength(7);

    const roleCounts = nodes.reduce<Record<string, number>>((acc, entry) => {
      const key = entry.nodeRole || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    expect(roleCounts.claim).toBe(3);
    expect(roleCounts.evidence).toBe(3);
    expect(roleCounts.witness).toBe(2);
    expect(roleCounts.timeline_event).toBe(1);

    const negligenceClaim = nodes.find(
      (entry) => (entry.text || '').toLowerCase().includes('negligently delayed incident response'),
    );
    const expertWitness = nodes.find(
      (entry) =>
        entry.nodeRole === 'witness' &&
        (entry.text || '').toLowerCase().includes('expert'),
    );

    expect(negligenceClaim).toBeTruthy();
    expect(expertWitness).toBeTruthy();

    const contradictionEdge = connectors.find(
      (entry) =>
        entry.relationType === 'contradicts' &&
        entry.toId === negligenceClaim?.id &&
        entry.fromId === expertWitness?.id,
    );
    expect(contradictionEdge).toBeTruthy();

    const strengths = evaluateClaimStrength(blueprint.objects);
    const levels = new Set(strengths.map((entry) => entry.level));
    expect(levels.has('strong')).toBe(true);
    expect(levels.has('medium')).toBe(true);
    expect(levels.has('weak')).toBe(true);
  });

  it('builds Contradiction Setup (DefectCo) with 5 nodes and James Park conflict sources', () => {
    const blueprint = buildDemoCasePack({
      pack: 'defectco',
      center: { x: 980, y: 700 },
      actorUserId: 'user-7',
      nowIso: '2026-02-23T00:00:00.000Z',
      createId: createDeterministicIdFactory('defectco'),
    });

    const nodes = blueprint.objects.filter((entry) => entry.type !== 'connector');
    expect(nodes).toHaveLength(5);

    const swornTestimonyNode = nodes.find((entry) =>
      (entry.text || '').toLowerCase().includes('no quality issues before march'),
    );
    const emailNode = nodes.find((entry) =>
      (entry.text || '').toLowerCase().includes('failure rate is already above threshold'),
    );

    expect(swornTestimonyNode).toBeTruthy();
    expect(emailNode).toBeTruthy();
  });
});
