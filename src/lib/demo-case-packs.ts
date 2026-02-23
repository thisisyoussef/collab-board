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

interface PackText {
  label: string;
  strongClaim: string;
  mediumClaim: string;
  weakClaim: string;
  evidencePrimary: string;
  evidenceSecondary: string;
  witness: string;
  timeline: string;
}

const PACK_TEXT: Record<DemoCasePackKey, PackText> = {
  pi: {
    label: 'Personal Injury',
    strongClaim: 'Claim: Failure to warn before recall notice',
    mediumClaim: 'Claim: Negligent post-market monitoring',
    weakClaim: 'Claim: Gross negligence damages enhancement',
    evidencePrimary: 'Evidence: Label revision log Ex.12',
    evidenceSecondary: 'Evidence: Internal safety memo Ex.7',
    witness: 'Witness: Safety engineer depo p.44',
    timeline: 'Timeline: Recall issued 2024-03-15',
  },
  employment: {
    label: 'Employment',
    strongClaim: 'Claim: Retaliation after protected complaint',
    mediumClaim: 'Claim: Pretextual performance discipline',
    weakClaim: 'Claim: Intentional infliction of emotional distress',
    evidencePrimary: 'Evidence: HR email chain Ex.7',
    evidenceSecondary: 'Evidence: Performance memo draft Ex.11',
    witness: 'Witness: Manager testimony variance',
    timeline: 'Timeline: Complaint -> warning -> termination',
  },
  criminal: {
    label: 'Criminal Defense',
    strongClaim: 'Claim: Timeline inconsistency undermines prosecution theory',
    mediumClaim: 'Claim: Witness identification reliability concerns',
    weakClaim: 'Claim: Complete suppression of all statements',
    evidencePrimary: 'Evidence: CCTV timestamp mismatch',
    evidenceSecondary: 'Evidence: Dispatch transcript excerpt',
    witness: 'Witness: Officer statement variance',
    timeline: 'Timeline: Arrest sequence reconstruction',
  },
};

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

  const strongClaim = createSticky(packText.strongClaim, claimX, topY, 'claim');
  const mediumClaim = createSticky(packText.mediumClaim, claimX, midY, 'claim');
  const weakClaim = createSticky(packText.weakClaim, claimX, lowY, 'claim');

  const evidencePrimary = createSticky(packText.evidencePrimary, evidenceX, topY, 'evidence');
  const evidenceSecondary = createSticky(packText.evidenceSecondary, evidenceX, midY, 'evidence');
  const witness = createSticky(packText.witness, witnessX, topY, 'witness');
  const timeline = createSticky(packText.timeline, timelineX, midY, 'timeline_event');

  createConnector(evidencePrimary.id, strongClaim.id, 'supports', 'supports');
  createConnector(witness.id, strongClaim.id, 'supports', 'supports');
  createConnector(timeline.id, strongClaim.id, 'supports', 'supports');
  createConnector(strongClaim.id, timeline.id, 'depends_on', 'depends_on');
  createConnector(evidenceSecondary.id, mediumClaim.id, 'supports', 'supports');
  createConnector(mediumClaim.id, timeline.id, 'depends_on', 'depends_on');
  createConnector(witness.id, weakClaim.id, 'contradicts', 'contradicts');

  return {
    pack,
    label: packText.label,
    objects,
    focusClaimId: strongClaim.id,
  };
}
