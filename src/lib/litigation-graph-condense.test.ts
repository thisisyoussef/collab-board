import { describe, expect, it } from 'vitest';
import { condenseLitigationDraftForLayout } from './litigation-graph-condense';
import type { LitigationIntakeDraft } from '../types/litigation';

function buildDenseDraft(): LitigationIntakeDraft {
  return {
    claims: [{ id: 'claim-1', title: 'Primary claim' }],
    evidence: Array.from({ length: 9 }, (_, index) => ({
      id: `evidence-${index + 1}`,
      label: `Exhibit ${index + 1}`,
    })),
    witnesses: Array.from({ length: 4 }, (_, index) => ({
      id: `witness-${index + 1}`,
      name: `Witness ${index + 1}`,
    })),
    timeline: Array.from({ length: 5 }, (_, index) => ({
      id: `timeline-${index + 1}`,
      dateLabel: `Mar ${index + 1}, 2023`,
      event: `Event ${index + 1}`,
    })),
    links: [
      ...Array.from({ length: 9 }, (_, index) => ({
        fromId: `evidence-${index + 1}`,
        toId: 'claim-1',
        relation: 'supports' as const,
        reason: 'Imported evidence',
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        fromId: `witness-${index + 1}`,
        toId: 'claim-1',
        relation: 'supports' as const,
        reason: 'Witness statement',
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        fromId: 'claim-1',
        toId: `timeline-${index + 1}`,
        relation: 'depends_on' as const,
        reason: 'Timeline dependency',
      })),
    ],
  };
}

describe('condenseLitigationDraftForLayout', () => {
  it('reduces graph density in summary mode and emits aggregate overflow nodes', () => {
    const denseDraft = buildDenseDraft();
    const condensed = condenseLitigationDraftForLayout(denseDraft, { mode: 'summary' });

    const supportLinks = condensed.links.filter((link) => link.relation === 'supports');
    const dependsLinks = condensed.links.filter((link) => link.relation === 'depends_on');
    expect(supportLinks.length).toBeLessThan(denseDraft.links.filter((link) => link.relation === 'supports').length);
    expect(dependsLinks.length).toBeLessThan(denseDraft.links.filter((link) => link.relation === 'depends_on').length);

    const aggregateEvidence = condensed.evidence.find((entry) => entry.id.startsWith('aggregate-evidence-'));
    expect(aggregateEvidence?.label.toLowerCase()).toContain('additional evidence');
    expect(aggregateEvidence?.citation).toBeUndefined();

    const aggregateWitness = condensed.witnesses.find((entry) => entry.id.startsWith('aggregate-witness-'));
    expect(aggregateWitness?.name.toLowerCase()).toContain('additional witness');
    expect(aggregateWitness?.quote).toBeUndefined();

    const aggregateTimeline = condensed.timeline.find((entry) => entry.id.startsWith('aggregate-timeline-'));
    expect(aggregateTimeline?.dateLabel.toLowerCase()).toContain('additional timeline');
    expect(aggregateTimeline?.event.toLowerCase()).toContain('grouped');
  });

  it('keeps expanded mode near-source fidelity while de-duplicating links', () => {
    const denseDraft = buildDenseDraft();
    const withDuplicateLink: LitigationIntakeDraft = {
      ...denseDraft,
      links: [...denseDraft.links, denseDraft.links[0]],
    };

    const expanded = condenseLitigationDraftForLayout(withDuplicateLink, { mode: 'expanded' });
    expect(expanded.links.length).toBe(denseDraft.links.length);
    expect(expanded.evidence.length).toBe(denseDraft.evidence.length);
    expect(expanded.witnesses.length).toBe(denseDraft.witnesses.length);
    expect(expanded.timeline.length).toBe(denseDraft.timeline.length);
  });

  it('defaults to expanded mode when no layout mode is provided', () => {
    const denseDraft = buildDenseDraft();
    const expanded = condenseLitigationDraftForLayout(denseDraft, { mode: 'expanded' });
    const defaultMode = condenseLitigationDraftForLayout(denseDraft);

    expect(defaultMode.claims.length).toBe(expanded.claims.length);
    expect(defaultMode.evidence.length).toBe(expanded.evidence.length);
    expect(defaultMode.witnesses.length).toBe(expanded.witnesses.length);
    expect(defaultMode.timeline.length).toBe(expanded.timeline.length);
    expect(defaultMode.links.length).toBe(expanded.links.length);
    expect(defaultMode.evidence.some((entry) => entry.id.startsWith('aggregate-evidence-'))).toBe(false);
    expect(defaultMode.witnesses.some((entry) => entry.id.startsWith('aggregate-witness-'))).toBe(false);
    expect(defaultMode.timeline.some((entry) => entry.id.startsWith('aggregate-timeline-'))).toBe(false);
  });
});
