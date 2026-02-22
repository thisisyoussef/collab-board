import { describe, expect, it } from 'vitest';
import type { BoardObject } from '../types/board';
import { evaluateClaimStrength, extractLitigationGraph } from './litigation-graph';

function buildObject(overrides: Partial<BoardObject>): BoardObject {
  return {
    id: overrides.id || 'obj',
    type: overrides.type || 'rect',
    x: overrides.x || 0,
    y: overrides.y || 0,
    width: overrides.width || 120,
    height: overrides.height || 80,
    rotation: overrides.rotation || 0,
    color: overrides.color || '#ffffff',
    zIndex: overrides.zIndex ?? 1,
    createdBy: overrides.createdBy || 'user-1',
    updatedAt: overrides.updatedAt || '2026-02-22T00:00:00.000Z',
    ...overrides,
  };
}

describe('litigation-graph', () => {
  it('extracts tagged graph relationships and computes deterministic claim scores', () => {
    const claimA = buildObject({ id: 'claim-a', type: 'text', text: 'Claim A' });
    const claimB = buildObject({ id: 'claim-b', type: 'text', text: 'Claim B', y: 120 });
    const evidence = buildObject({ id: 'evidence-1', type: 'sticky', x: 280 });
    const witness = buildObject({ id: 'witness-1', type: 'sticky', x: 280, y: 120 });
    const timeline = buildObject({ id: 'timeline-1', type: 'sticky', x: 280, y: 240 });

    const supportFromEvidence = buildObject({
      id: 'edge-support-1',
      type: 'connector',
      fromId: evidence.id,
      toId: claimA.id,
      points: [280, 30, 120, 20],
    });
    const supportFromWitness = buildObject({
      id: 'edge-support-2',
      type: 'connector',
      fromId: witness.id,
      toId: claimA.id,
      points: [280, 150, 120, 20],
    });
    const contradiction = buildObject({
      id: 'edge-contradict',
      type: 'connector',
      fromId: witness.id,
      toId: claimA.id,
      points: [280, 150, 120, 20],
    });
    const dependency = buildObject({
      id: 'edge-depends',
      type: 'connector',
      fromId: claimA.id,
      toId: timeline.id,
      points: [120, 20, 280, 250],
    });
    const invalidConnector = buildObject({
      id: 'edge-invalid',
      type: 'connector',
      fromId: claimA.id,
      toId: claimB.id,
      points: [120, 20, 120, 140],
      label: 'custom',
    });

    const objects = [
      { ...claimA, nodeRole: 'claim' } as BoardObject,
      { ...claimB, nodeRole: 'claim' } as BoardObject,
      { ...evidence, nodeRole: 'evidence' } as BoardObject,
      { ...witness, nodeRole: 'witness' } as BoardObject,
      { ...timeline, nodeRole: 'timeline_event' } as BoardObject,
      { ...supportFromEvidence, relationType: 'supports' } as BoardObject,
      { ...supportFromWitness, relationType: 'supports' } as BoardObject,
      { ...contradiction, relationType: 'contradicts' } as BoardObject,
      { ...dependency, relationType: 'depends_on' } as BoardObject,
      invalidConnector,
    ];

    const graph = extractLitigationGraph(objects);
    expect(graph.claimIds).toEqual(['claim-a', 'claim-b']);
    expect(graph.edges).toHaveLength(4);

    const results = evaluateClaimStrength(objects);
    expect(results).toHaveLength(2);

    expect(results[0]).toMatchObject({
      claimId: 'claim-a',
      supportCount: 2,
      contradictionCount: 1,
      dependencyGapCount: 0,
      score: 58,
      level: 'medium',
    });
    expect(results[1]).toMatchObject({
      claimId: 'claim-b',
      supportCount: 0,
      contradictionCount: 0,
      dependencyGapCount: 1,
      score: 35,
      level: 'weak',
    });
  });

  it('caps score contributions and penalties deterministically', () => {
    const claim = { ...buildObject({ id: 'claim-cap', type: 'text' }), nodeRole: 'claim' } as BoardObject;

    const supportingEvidence = Array.from({ length: 8 }, (_, index) =>
      ({ ...buildObject({ id: `evidence-${index}`, type: 'sticky', x: 200 + index * 10 }), nodeRole: 'evidence' }) as BoardObject,
    );
    const supportEdges = supportingEvidence.map((entry, index) =>
      ({ ...buildObject({ id: `support-edge-${index}`, type: 'connector', fromId: entry.id, toId: claim.id }), relationType: 'supports' }) as BoardObject,
    );

    const witnesses = Array.from({ length: 6 }, (_, index) =>
      ({ ...buildObject({ id: `witness-${index}`, type: 'sticky', y: 100 + index * 8 }), nodeRole: 'witness' }) as BoardObject,
    );
    const contradictionEdges = witnesses.map((entry, index) =>
      ({ ...buildObject({ id: `contradiction-edge-${index}`, type: 'connector', fromId: entry.id, toId: claim.id }), relationType: 'contradicts' }) as BoardObject,
    );

    const dependencyEdges = Array.from({ length: 4 }, (_, index) =>
      ({ ...buildObject({ id: `dependency-edge-${index}`, type: 'connector', fromId: claim.id, toId: `missing-${index}` }), relationType: 'depends_on' }) as BoardObject,
    );

    const results = evaluateClaimStrength([
      claim,
      ...supportingEvidence,
      ...supportEdges,
      ...witnesses,
      ...contradictionEdges,
      ...dependencyEdges,
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      claimId: 'claim-cap',
      supportCount: 8,
      contradictionCount: 6,
      dependencyGapCount: 4,
      score: 24,
      level: 'weak',
    });
  });
});
