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
    expect(firstClaimCreate?.input.x).toBe(104);
    expect(firstClaimCreate?.input.y).toBe(152);
    expect(firstClaimCreate?.input.width).toBe(412);
    expect(firstClaimCreate?.input.height).toBe(102);
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

  it('expands lane heights and uses multi-column card layout for dense drafts', () => {
    const denseDraft = {
      claims: [{ id: 'claim-main', title: 'Main claim' }],
      evidence: Array.from({ length: 4 }, (_, index) => ({
        id: `evidence-${index + 1}`,
        label: `Exhibit ${index + 1}`,
      })),
      witnesses: Array.from({ length: 10 }, (_, index) => ({
        id: `witness-${index + 1}`,
        name: `Witness ${index + 1}`,
        quote: `Statement ${index + 1}`,
      })),
      timeline: Array.from({ length: 10 }, (_, index) => ({
        id: `timeline-${index + 1}`,
        dateLabel: `Mar ${index + 1}, 2023`,
        event: `Event ${index + 1}`,
      })),
      links: Array.from({ length: 20 }, (_, index) => ({
        fromId: index < 10 ? `witness-${index + 1}` : `timeline-${index - 9}`,
        toId: 'claim-main',
        relation: 'supports' as const,
        reason: 'Witness statement linked during intake parsing',
      })),
    };

    const result = buildBoardActionsFromLitigationDraft(denseDraft, { layoutMode: 'expanded' });

    const witnessFrame = result.actions.find(
      (action) => action.name === 'createFrame' && action.input.objectId === 'intake-frame-witnesses',
    );
    const timelineFrame = result.actions.find(
      (action) => action.name === 'createFrame' && action.input.objectId === 'intake-frame-timeline',
    );
    expect(witnessFrame?.input.height).toBeGreaterThan(650);
    expect(timelineFrame?.input.height).toBeGreaterThan(650);

    const witnessCards = result.actions.filter(
      (action) => action.name === 'createStickyNote' && String(action.input.objectId).startsWith('witness-'),
    );
    const witnessXPositions = new Set(witnessCards.map((card) => card.input.x));
    expect(witnessXPositions.size).toBeGreaterThan(1);

    const connectors = result.actions.filter((action) => action.name === 'createConnector');
    expect(connectors.length).toBeGreaterThan(0);
    expect(connectors.every((connector) => connector.input.label === undefined)).toBe(true);
    expect(connectors.every((connector) => connector.input.connectorType === 'curved')).toBe(true);
  });

  it('keeps full-detail layout even when summary mode is requested', () => {
    const denseDraft = {
      claims: [{ id: 'claim-main', title: 'Main claim' }],
      evidence: Array.from({ length: 9 }, (_, index) => ({
        id: `evidence-${index + 1}`,
        label: `Exhibit ${index + 1}`,
      })),
      witnesses: Array.from({ length: 4 }, (_, index) => ({
        id: `witness-${index + 1}`,
        name: `Witness ${index + 1}`,
        quote: `Statement ${index + 1}`,
      })),
      timeline: Array.from({ length: 5 }, (_, index) => ({
        id: `timeline-${index + 1}`,
        dateLabel: `Mar ${index + 1}, 2023`,
        event: `Event ${index + 1}`,
      })),
      links: [
        ...Array.from({ length: 9 }, (_, index) => ({
          fromId: `evidence-${index + 1}`,
          toId: 'claim-main',
          relation: 'supports' as const,
          reason: 'Evidence support',
        })),
        ...Array.from({ length: 4 }, (_, index) => ({
          fromId: `witness-${index + 1}`,
          toId: 'claim-main',
          relation: 'supports' as const,
          reason: 'Witness support',
        })),
        ...Array.from({ length: 5 }, (_, index) => ({
          fromId: 'claim-main',
          toId: `timeline-${index + 1}`,
          relation: 'depends_on' as const,
          reason: 'Timeline dependency',
        })),
      ],
    };

    const expanded = buildBoardActionsFromLitigationDraft(denseDraft, { layoutMode: 'expanded' });
    const summary = buildBoardActionsFromLitigationDraft(denseDraft, { layoutMode: 'summary' });

    const expandedConnectors = expanded.actions.filter((action) => action.name === 'createConnector');
    const summaryConnectors = summary.actions.filter((action) => action.name === 'createConnector');
    expect(summaryConnectors.length).toBe(expandedConnectors.length);

    const summaryStickyTexts = summary.actions
      .filter((action) => action.name === 'createStickyNote')
      .map((action) => String(action.input.text));

    expect(summaryStickyTexts.some((text) => text.toLowerCase().includes('additional evidence'))).toBe(false);
    expect(summaryStickyTexts.some((text) => text.toLowerCase().includes('additional witness'))).toBe(false);
    expect(summaryStickyTexts.some((text) => text.toLowerCase().includes('additional timeline'))).toBe(false);
  });

  it('renders full-detail card text regardless of requested density mode', () => {
    const draft = {
      claims: [
        {
          id: 'claim-1',
          title: 'First-degree murder',
          summary: 'Deliberate design with premeditation indicators',
        },
      ],
      evidence: [
        {
          id: 'evidence-1',
          label: 'Autopsy report',
          citation: 'Exhibit 4',
        },
      ],
      witnesses: [
        {
          id: 'witness-1',
          name: 'Lou Christoff',
          quote: 'I saw Lane with a knife',
          citation: 'Dep. 44:12-45:3',
        },
      ],
      timeline: [
        {
          id: 'timeline-1',
          dateLabel: 'March 25, 2023',
          event: 'Incident date at restaurant parking lot',
        },
      ],
      links: [
        { fromId: 'evidence-1', toId: 'claim-1', relation: 'supports' as const },
        { fromId: 'witness-1', toId: 'claim-1', relation: 'supports' as const },
      ],
    };

    const summary = buildBoardActionsFromLitigationDraft(draft, { layoutMode: 'summary' });
    const expanded = buildBoardActionsFromLitigationDraft(draft, { layoutMode: 'expanded' });

    const summaryEvidence = summary.actions.find(
      (action) => action.name === 'createStickyNote' && action.input.objectId === 'evidence-1',
    );
    const expandedEvidence = expanded.actions.find(
      (action) => action.name === 'createStickyNote' && action.input.objectId === 'evidence-1',
    );
    expect(String(summaryEvidence?.input.text)).toContain('Exhibit 4');
    expect(String(expandedEvidence?.input.text)).toContain('Exhibit 4');

    const summaryWitness = summary.actions.find(
      (action) => action.name === 'createStickyNote' && action.input.objectId === 'witness-1',
    );
    const expandedWitness = expanded.actions.find(
      (action) => action.name === 'createStickyNote' && action.input.objectId === 'witness-1',
    );
    expect(String(summaryWitness?.input.text)).toContain('I saw Lane with a knife');
    expect(String(expandedWitness?.input.text)).toContain('I saw Lane with a knife');
  });

  it('reorders lane positions by objective so focus changes are visually obvious', () => {
    const chronology = buildBoardActionsFromLitigationDraft(sampleDraft, {
      objective: 'chronology',
      layoutMode: 'summary',
    });
    const witnessPrep = buildBoardActionsFromLitigationDraft(sampleDraft, {
      objective: 'witness_prep',
      layoutMode: 'summary',
    });
    const contradictions = buildBoardActionsFromLitigationDraft(sampleDraft, {
      objective: 'contradictions',
      layoutMode: 'summary',
    });

    const chronologyTimelineFrame = chronology.actions.find(
      (action) => action.name === 'createFrame' && action.input.objectId === 'intake-frame-timeline',
    );
    const witnessPrepWitnessFrame = witnessPrep.actions.find(
      (action) => action.name === 'createFrame' && action.input.objectId === 'intake-frame-witnesses',
    );
    const contradictionsWitnessFrame = contradictions.actions.find(
      (action) => action.name === 'createFrame' && action.input.objectId === 'intake-frame-witnesses',
    );
    const contradictionsClaimsFrame = contradictions.actions.find(
      (action) => action.name === 'createFrame' && action.input.objectId === 'intake-frame-claims',
    );

    expect(chronologyTimelineFrame?.input.x).toBe(80);
    expect(chronologyTimelineFrame?.input.y).toBe(80);

    expect(witnessPrepWitnessFrame?.input.x).toBe(80);
    expect(witnessPrepWitnessFrame?.input.y).toBe(80);

    expect(contradictionsWitnessFrame?.input.x).toBe(80);
    expect(contradictionsWitnessFrame?.input.y).toBe(80);
    expect(contradictionsClaimsFrame?.input.x).toBeGreaterThan(
      Number(contradictionsWitnessFrame?.input.x ?? 0),
    );
    expect(contradictionsClaimsFrame?.input.y).toBe(80);
  });
});
