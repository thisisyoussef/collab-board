import { describe, it, expect } from 'vitest';
import { buildClaimSubgraph } from '../hooks/useClaimClassification';
import type { BoardObject } from '../types/board';

function makeObject(overrides: Partial<BoardObject>): BoardObject {
  return {
    id: 'obj-1',
    type: 'sticky',
    x: 0, y: 0, width: 100, height: 100,
    rotation: 0,
    color: '#fff',
    zIndex: 1,
    createdBy: 'user-1',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('buildClaimSubgraph', () => {
  it('returns null for non-claim nodes', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('obj-1', makeObject({ id: 'obj-1', nodeRole: 'evidence', text: 'Some evidence' }));
    expect(buildClaimSubgraph('obj-1', objects)).toBeNull();
  });

  it('extracts claim text and connected supporting evidence', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('claim-1', makeObject({ id: 'claim-1', nodeRole: 'claim', text: 'Defendant was present' }));
    objects.set('ev-1', makeObject({ id: 'ev-1', nodeRole: 'evidence', text: 'CCTV footage' }));
    objects.set('conn-1', makeObject({
      id: 'conn-1', type: 'connector', fromId: 'ev-1', toId: 'claim-1', relationType: 'supports',
    }));
    const result = buildClaimSubgraph('claim-1', objects);
    expect(result).toEqual({
      claimId: 'claim-1',
      claimText: 'Defendant was present',
      connectedNodes: [
        { id: 'ev-1', role: 'evidence', text: 'CCTV footage', relationToClaim: 'supports' },
      ],
    });
  });

  it('returns empty connectedNodes when claim has no connections', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('claim-1', makeObject({ id: 'claim-1', nodeRole: 'claim', text: 'Solo claim' }));
    const result = buildClaimSubgraph('claim-1', objects);
    expect(result).toEqual({
      claimId: 'claim-1',
      claimText: 'Solo claim',
      connectedNodes: [],
    });
  });
});
