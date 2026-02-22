import { describe, expect, it } from 'vitest';
import { buildBoardActionsFromLitigationDraft } from './litigation-intake-layout';

const sampleDraft = {
  claims: [
    { id: 'claim-design-defect', title: 'Design defect' },
    { id: 'claim-failure-warn', title: 'Failure to warn' },
  ],
  evidence: [
    { id: 'evidence-ex12', label: 'Ex.12 Internal Memo' },
  ],
  witnesses: [
    { id: 'witness-dr-lee', name: 'Dr. Lee', quote: 'Alarm frequency increased' },
  ],
  timeline: [
    { id: 'event-2024-03', dateLabel: 'Mar 2024', event: 'Repeated device alarms' },
  ],
  links: [
    {
      fromId: 'evidence-ex12',
      toId: 'claim-design-defect',
      relation: 'supports' as const,
      reason: 'Memo reports escalating anomalies',
    },
  ],
};

describe('buildBoardActionsFromLitigationDraft', () => {
  it('creates deterministic frame + node + connector actions', () => {
    const result = buildBoardActionsFromLitigationDraft(sampleDraft);

    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.actions.filter((action) => action.name === 'createFrame')).toHaveLength(4);
    expect(result.actions.some((action) => action.name === 'createConnector')).toBe(true);

    const firstClaimCreate = result.actions.find(
      (action) => action.name === 'createStickyNote' && action.input.objectId === 'claim-design-defect',
    );
    expect(firstClaimCreate?.input.x).toBe(140);
    expect(firstClaimCreate?.input.y).toBe(170);
  });

  it('returns empty actions for empty draft', () => {
    const result = buildBoardActionsFromLitigationDraft({
      claims: [],
      evidence: [],
      witnesses: [],
      timeline: [],
      links: [],
    });

    expect(result.actions).toEqual([]);
  });
});
