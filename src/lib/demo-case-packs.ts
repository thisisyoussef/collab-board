import type { BoardObject, LitigationConnectorRelation, LitigationNodeRole } from '../types/board';
import type { DemoCasePackKey } from '../types/claim-strength-tools';
import { createDefaultObject, CONNECTOR_RELATION_COLORS } from './board-object';

interface BuildDemoCasePackInput {
  pack: DemoCasePackKey;
  center: { x: number; y: number };
  actorUserId: string;
  nowIso?: string;
  createId?: () => string;
}

export interface DemoCasePackBlueprint {
  pack: DemoCasePackKey;
  label: string;
  objects: BoardObject[];
  focusClaimId: string;
}

type PackNodeKey =
  | 'strongClaim'
  | 'mediumClaim'
  | 'weakClaim'
  | 'evidencePrimary'
  | 'evidenceSecondary'
  | 'witness'
  | 'timeline';

interface PackConnectorPlan {
  from: PackNodeKey;
  to: PackNodeKey;
  relationType: LitigationConnectorRelation;
  label: string;
}

interface PackText {
  label: string;
  launcherLabel: string;
  strongClaim: string;
  mediumClaim: string;
  weakClaim: string;
  evidencePrimary: string;
  evidenceSecondary: string;
  witness: string;
  timeline: string;
  connectorPlan: PackConnectorPlan[];
}

const DEFAULT_CONNECTOR_PLAN: PackConnectorPlan[] = [
  {
    from: 'evidencePrimary',
    to: 'strongClaim',
    relationType: 'supports',
    label: 'supports',
  },
  {
    from: 'witness',
    to: 'strongClaim',
    relationType: 'supports',
    label: 'supports',
  },
  {
    from: 'timeline',
    to: 'strongClaim',
    relationType: 'supports',
    label: 'supports',
  },
  {
    from: 'strongClaim',
    to: 'timeline',
    relationType: 'depends_on',
    label: 'depends_on',
  },
  {
    from: 'evidenceSecondary',
    to: 'mediumClaim',
    relationType: 'supports',
    label: 'supports',
  },
  {
    from: 'mediumClaim',
    to: 'timeline',
    relationType: 'depends_on',
    label: 'depends_on',
  },
  {
    from: 'witness',
    to: 'weakClaim',
    relationType: 'contradicts',
    label: 'contradicts',
  },
];

const PACK_TEXT: Record<DemoCasePackKey, PackText> = {
  pi: {
    label: 'Personal Injury',
    launcherLabel: 'Load PI pack',
    strongClaim: 'Claim: Failure to warn before recall notice',
    mediumClaim: 'Claim: Negligent post-market monitoring',
    weakClaim: 'Claim: Gross negligence damages enhancement',
    evidencePrimary: 'Evidence: Label revision log Ex.12',
    evidenceSecondary: 'Evidence: Internal safety memo Ex.7',
    witness: 'Witness: Safety engineer depo p.44',
    timeline: 'Timeline: Recall issued 2024-03-15',
    connectorPlan: DEFAULT_CONNECTOR_PLAN,
  },
  employment: {
    label: 'Employment',
    launcherLabel: 'Load Employment pack',
    strongClaim: 'Claim: Retaliation after protected complaint',
    mediumClaim: 'Claim: Pretextual performance discipline',
    weakClaim: 'Claim: Intentional infliction of emotional distress',
    evidencePrimary: 'Evidence: HR email chain Ex.7',
    evidenceSecondary: 'Evidence: Performance memo draft Ex.11',
    witness: 'Witness: Manager testimony variance',
    timeline: 'Timeline: Complaint -> warning -> termination',
    connectorPlan: DEFAULT_CONNECTOR_PLAN,
  },
  criminal: {
    label: 'Criminal Defense',
    launcherLabel: 'Load Criminal pack',
    strongClaim: 'Claim: Timeline inconsistency undermines prosecution theory',
    mediumClaim: 'Claim: Witness identification reliability concerns',
    weakClaim: 'Claim: Complete suppression of all statements',
    evidencePrimary: 'Evidence: CCTV timestamp mismatch',
    evidenceSecondary: 'Evidence: Dispatch transcript excerpt',
    witness: 'Witness: Officer statement variance',
    timeline: 'Timeline: Arrest sequence reconstruction',
    connectorPlan: DEFAULT_CONNECTOR_PLAN,
  },
  credibility: {
    label: 'Witness Credibility Drill',
    launcherLabel: 'Load Credibility pack',
    strongClaim:
      'Claim: Supervisors instructed off-book quota edits.\nRationale: Independent testimony matches payroll logs.',
    mediumClaim:
      'Claim: HR response delay worsened retaliation exposure.\nRationale: Delay exists, but intent evidence is mixed.',
    weakClaim:
      'Claim: Executive leadership ordered direct retaliation.\nRationale: Theory depends on conflicting witness narratives.',
    evidencePrimary: 'Evidence: Payroll delta report Ex.18',
    evidenceSecondary: 'Evidence: HR ticket response audit Ex.9',
    witness: 'Witness: Analyst + manager interview summaries',
    timeline: 'Timeline: Complaint -> audit alert -> corrective action -> termination',
    connectorPlan: [
      {
        from: 'evidencePrimary',
        to: 'strongClaim',
        relationType: 'supports',
        label: 'supports',
      },
      {
        from: 'timeline',
        to: 'strongClaim',
        relationType: 'supports',
        label: 'supports',
      },
      {
        from: 'strongClaim',
        to: 'timeline',
        relationType: 'depends_on',
        label: 'depends_on',
      },
      {
        from: 'evidenceSecondary',
        to: 'mediumClaim',
        relationType: 'supports',
        label: 'supports',
      },
      {
        from: 'witness',
        to: 'mediumClaim',
        relationType: 'supports',
        label: 'supports',
      },
      {
        from: 'timeline',
        to: 'mediumClaim',
        relationType: 'contradicts',
        label: 'contradicts',
      },
      {
        from: 'mediumClaim',
        to: 'timeline',
        relationType: 'depends_on',
        label: 'depends_on',
      },
      {
        from: 'witness',
        to: 'weakClaim',
        relationType: 'contradicts',
        label: 'contradicts',
      },
      {
        from: 'evidenceSecondary',
        to: 'weakClaim',
        relationType: 'contradicts',
        label: 'contradicts',
      },
    ],
  },
  causation: {
    label: 'Causation Chain Drill',
    launcherLabel: 'Load Causation pack',
    strongClaim:
      'Claim: Defective alarm circuit caused delayed evacuation.\nRationale: Device logs, witness account, and timeline align.',
    mediumClaim:
      'Claim: Safety training gap increased injury risk.\nRationale: One record supports the gap, but scope is limited.',
    weakClaim:
      'Claim: Vendor fraud alone caused all downstream losses.\nRationale: Alternative causes remain unresolved.',
    evidencePrimary: 'Evidence: Alarm diagnostics export Ex.4',
    evidenceSecondary: 'Evidence: Training attendance worksheet Ex.11',
    witness: 'Witness: Floor lead evacuation testimony',
    timeline: 'Timeline: Alarm fault -> delayed alert -> stairwell injuries',
    connectorPlan: [
      {
        from: 'evidencePrimary',
        to: 'strongClaim',
        relationType: 'supports',
        label: 'supports',
      },
      {
        from: 'witness',
        to: 'strongClaim',
        relationType: 'supports',
        label: 'supports',
      },
      {
        from: 'timeline',
        to: 'strongClaim',
        relationType: 'supports',
        label: 'supports',
      },
      {
        from: 'strongClaim',
        to: 'timeline',
        relationType: 'depends_on',
        label: 'depends_on',
      },
      {
        from: 'evidenceSecondary',
        to: 'mediumClaim',
        relationType: 'supports',
        label: 'supports',
      },
      {
        from: 'mediumClaim',
        to: 'witness',
        relationType: 'depends_on',
        label: 'depends_on',
      },
      {
        from: 'witness',
        to: 'weakClaim',
        relationType: 'supports',
        label: 'supports',
      },
      {
        from: 'timeline',
        to: 'weakClaim',
        relationType: 'contradicts',
        label: 'contradicts',
      },
    ],
  },
  damages: {
    label: 'Damages Exposure Drill',
    launcherLabel: 'Load Damages pack',
    strongClaim:
      'Claim: Lost revenue model is defensible through FY projections.\nRationale: Forecast ties to dated bookings and market reports.',
    mediumClaim:
      'Claim: Mitigation efforts were partially reasonable.\nRationale: Some mitigation exists, but contradictory conduct remains.',
    weakClaim:
      'Claim: Punitive multiplier should apply across all counts.\nRationale: Intent evidence is currently speculative.',
    evidencePrimary: 'Evidence: Revenue waterfall model Ex.21',
    evidenceSecondary: 'Evidence: Mitigation memo + vendor bids Ex.13',
    witness: 'Witness: CFO deposition excerpts on loss assumptions',
    timeline: 'Timeline: Breach notice -> customer churn -> revised forecast',
    connectorPlan: [
      {
        from: 'evidencePrimary',
        to: 'strongClaim',
        relationType: 'supports',
        label: 'supports',
      },
      {
        from: 'timeline',
        to: 'strongClaim',
        relationType: 'supports',
        label: 'supports',
      },
      {
        from: 'strongClaim',
        to: 'timeline',
        relationType: 'depends_on',
        label: 'depends_on',
      },
      {
        from: 'evidenceSecondary',
        to: 'mediumClaim',
        relationType: 'supports',
        label: 'supports',
      },
      {
        from: 'witness',
        to: 'mediumClaim',
        relationType: 'contradicts',
        label: 'contradicts',
      },
      {
        from: 'mediumClaim',
        to: 'evidencePrimary',
        relationType: 'depends_on',
        label: 'depends_on',
      },
      {
        from: 'witness',
        to: 'weakClaim',
        relationType: 'contradicts',
        label: 'contradicts',
      },
    ],
  },
  johnson: {
    label: 'Strong Case · Johnson v. TechCorp',
    launcherLabel: 'Load Strong Case (Johnson v. TechCorp)',
    strongClaim:
      'Claim: TechCorp breached the Section 4.2 uptime covenant.\nRationale: Contract language, outage records, and notice timing align.',
    mediumClaim:
      'Claim: TechCorp negligently delayed incident response.\nRationale: Delay evidence exists, but expert review disputes breach of care.',
    weakClaim:
      'Claim: Johnson can recover an enhanced consequential-damages multiplier.\nRationale: Contract trigger and intent evidence remain thin.',
    evidencePrimary: 'Evidence: Master Services Agreement §4.2 uptime covenant (Ex. 1)',
    evidenceSecondary: 'Evidence: Incident response timeline + pager logs (Ex. 6)',
    witness: 'Witness: CFO Maria Chen testimony on outage notice and business impact',
    timeline: 'Timeline: 03/14 outage -> 03/15 cure notice -> 03/18 mitigation call',
    connectorPlan: [],
  },
  defectco: {
    label: 'Contradiction Setup · DefectCo',
    launcherLabel: 'Load Contradiction Setup (DefectCo)',
    strongClaim: 'Claim: DefectCo had no notice of quality issues before March 2025.',
    mediumClaim: '',
    weakClaim: '',
    evidencePrimary:
      'Evidence: James Park email (2025-02-20) — "Failure rate is already above threshold; we need containment now."',
    evidenceSecondary: 'Evidence: QA dashboard snapshot (2025-02-18) shows failure rate at 7.9%',
    witness:
      'Witness: James Park sworn testimony — "We had no quality issues before March." (Dep. p.41)',
    timeline: 'Timeline: 02/20 internal escalation -> 03/03 external incident disclosure',
    connectorPlan: [],
  },
};

const DEMO_CASE_PACK_ORDER: DemoCasePackKey[] = [
  'pi',
  'employment',
  'criminal',
  'credibility',
  'causation',
  'damages',
  'johnson',
  'defectco',
];

export const DEMO_CASE_PACK_OPTIONS: ReadonlyArray<{ pack: DemoCasePackKey; menuLabel: string }> =
  DEMO_CASE_PACK_ORDER.map((pack) => ({
    pack,
    menuLabel: PACK_TEXT[pack].launcherLabel,
  }));

function fallbackCreateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `demo-${Math.random().toString(36).slice(2, 10)}`;
}

function relationColor(relation: LitigationConnectorRelation): string {
  return CONNECTOR_RELATION_COLORS[relation]?.color || '#4A8FCC';
}

export function buildDemoCasePack({
  pack,
  center,
  actorUserId,
  nowIso = new Date().toISOString(),
  createId = fallbackCreateId,
}: BuildDemoCasePackInput): DemoCasePackBlueprint {
  const packText = PACK_TEXT[pack];
  const objects: BoardObject[] = [];

  const createSticky = (
    text: string,
    x: number,
    y: number,
    nodeRole: LitigationNodeRole,
  ): BoardObject => {
    const object = createDefaultObject('sticky', {
      id: createId(),
      x,
      y,
      width: 260,
      height: 138,
      text,
      nodeRole,
      createdBy: actorUserId,
      updatedAt: nowIso,
    });
    objects.push(object);
    return object;
  };

  const createConnector = (
    fromId: string,
    toId: string,
    relationType: LitigationConnectorRelation,
    label: string,
  ) => {
    const object = createDefaultObject('connector', {
      id: createId(),
      fromId,
      toId,
      x: 0,
      y: 0,
      points: [0, 0, 1, 1],
      relationType,
      label,
      color: relationColor(relationType),
      strokeStyle: relationType === 'contradicts' ? 'dashed' : 'solid',
      connectorType: 'curved',
      startArrow: 'none',
      endArrow: 'solid',
      createdBy: actorUserId,
      updatedAt: nowIso,
    });
    objects.push(object);
  };

  const claimX = Math.round(center.x - 240);
  const evidenceX = claimX + 360;
  const witnessX = claimX + 720;
  const timelineX = claimX + 1080;
  const topY = Math.round(center.y - 260);
  const midY = Math.round(center.y - 40);
  const lowY = Math.round(center.y + 180);

  if (pack === 'johnson') {
    const strongClaim = createSticky(packText.strongClaim, claimX, topY, 'claim');
    const mediumClaim = createSticky(packText.mediumClaim, claimX, midY, 'claim');
    const weakClaim = createSticky(packText.weakClaim, claimX, lowY, 'claim');

    const evidencePrimary = createSticky(packText.evidencePrimary, evidenceX, topY, 'evidence');
    const evidenceSecondary = createSticky(packText.evidenceSecondary, evidenceX, midY, 'evidence');
    const evidenceDamages = createSticky(
      'Evidence: Damages model spreadsheet draft and assumptions memo (Ex. 12)',
      evidenceX,
      lowY,
      'evidence',
    );

    const witnessFact = createSticky(packText.witness, witnessX, topY, 'witness');
    const witnessExpert = createSticky(
      'Witness: Expert Dr. Elena Ruiz report — response latency remained within industry norms.',
      witnessX,
      midY,
      'witness',
    );

    const timeline = createSticky(packText.timeline, timelineX, midY, 'timeline_event');

    createConnector(evidencePrimary.id, strongClaim.id, 'supports', 'supports: contractual duty');
    createConnector(witnessFact.id, strongClaim.id, 'supports', 'supports: breach notice chain');
    createConnector(strongClaim.id, timeline.id, 'depends_on', 'depends_on: outage chronology');
    createConnector(evidenceSecondary.id, mediumClaim.id, 'supports', 'supports: response logs');
    createConnector(evidenceDamages.id, mediumClaim.id, 'supports', 'supports: remediation lag analysis');
    createConnector(timeline.id, mediumClaim.id, 'supports', 'supports: sequence of response windows');
    createConnector(
      witnessExpert.id,
      mediumClaim.id,
      'contradicts',
      'contradicts: expert says response remained reasonable',
    );

    return {
      pack,
      label: packText.label,
      objects,
      focusClaimId: mediumClaim.id,
    };
  }

  if (pack === 'defectco') {
    const noNoticeClaim = createSticky(packText.strongClaim, claimX, midY, 'claim');
    const swornTestimony = createSticky(packText.witness, witnessX, topY, 'witness');
    const warningEmail = createSticky(packText.evidencePrimary, evidenceX, topY, 'evidence');
    const qaDashboard = createSticky(packText.evidenceSecondary, evidenceX, lowY, 'evidence');
    const timeline = createSticky(packText.timeline, timelineX, midY, 'timeline_event');

    createConnector(swornTestimony.id, noNoticeClaim.id, 'supports', 'supports: sworn no-issues statement');
    createConnector(warningEmail.id, noNoticeClaim.id, 'contradicts', 'contradicts: Feb 20 warning email');
    createConnector(qaDashboard.id, noNoticeClaim.id, 'contradicts', 'contradicts: pre-March failure metrics');
    createConnector(timeline.id, noNoticeClaim.id, 'contradicts', 'contradicts: escalation chronology');

    return {
      pack,
      label: packText.label,
      objects,
      focusClaimId: noNoticeClaim.id,
    };
  }

  const nodesByKey: Record<PackNodeKey, BoardObject> = {
    strongClaim: createSticky(packText.strongClaim, claimX, topY, 'claim'),
    mediumClaim: createSticky(packText.mediumClaim, claimX, midY, 'claim'),
    weakClaim: createSticky(packText.weakClaim, claimX, lowY, 'claim'),
    evidencePrimary: createSticky(packText.evidencePrimary, evidenceX, topY, 'evidence'),
    evidenceSecondary: createSticky(packText.evidenceSecondary, evidenceX, midY, 'evidence'),
    witness: createSticky(packText.witness, witnessX, topY, 'witness'),
    timeline: createSticky(packText.timeline, timelineX, midY, 'timeline_event'),
  };

  packText.connectorPlan.forEach((connector) => {
    const fromNode = nodesByKey[connector.from];
    const toNode = nodesByKey[connector.to];
    createConnector(fromNode.id, toNode.id, connector.relationType, connector.label);
  });

  return {
    pack,
    label: packText.label,
    objects,
    focusClaimId: nodesByKey.strongClaim.id,
  };
}
