import type {
  LitigationDraftClaim,
  LitigationDraftEvidence,
  LitigationDraftLink,
  LitigationDraftTimelineEvent,
  LitigationDraftWitness,
  LitigationIntakeDraft,
  LitigationIntakeObjective,
  LitigationLayoutMode,
} from '../types/litigation';

type NodeBucket = 'claim' | 'evidence' | 'witness' | 'timeline' | 'unknown';
type ClaimIncomingRelation = 'supports' | 'contradicts';

interface CondenseOptions {
  mode?: LitigationLayoutMode;
  objective?: LitigationIntakeObjective;
}

interface RelationLimits {
  supports: number;
  contradicts: number;
  depends_on: number;
}

interface LinkSelectionResult {
  kept: LitigationDraftLink[];
  overflowByBucket: Map<NodeBucket, number>;
}

const DEFAULT_OBJECTIVE: LitigationIntakeObjective = 'board_overview';
const DEFAULT_LAYOUT_MODE: LitigationLayoutMode = 'summary';
const INCOMING_BUCKET_ORDER: NodeBucket[] = ['evidence', 'witness', 'timeline', 'claim', 'unknown'];
const OUTGOING_BUCKET_ORDER: NodeBucket[] = ['timeline', 'evidence', 'witness', 'claim', 'unknown'];

const OBJECTIVE_LIMITS: Record<LitigationIntakeObjective, RelationLimits> = {
  board_overview: {
    supports: 6,
    contradicts: 4,
    depends_on: 3,
  },
  chronology: {
    supports: 4,
    contradicts: 3,
    depends_on: 7,
  },
  contradictions: {
    supports: 4,
    contradicts: 7,
    depends_on: 3,
  },
  witness_prep: {
    supports: 7,
    contradicts: 4,
    depends_on: 4,
  },
};

function dedupeLinks(links: LitigationDraftLink[]): LitigationDraftLink[] {
  const seen = new Set<string>();
  const deduped: LitigationDraftLink[] = [];

  links.forEach((link) => {
    const key = `${link.fromId}::${link.toId}::${link.relation}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    deduped.push(link);
  });

  return deduped;
}

function pluralize(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? '' : 's'}`;
}

function ensureUniqueId(baseId: string, usedIds: Set<string>): string {
  const candidate = baseId.trim() || 'aggregate-node';
  if (!usedIds.has(candidate)) {
    usedIds.add(candidate);
    return candidate;
  }

  let suffix = 2;
  while (usedIds.has(`${candidate}-${suffix}`)) {
    suffix += 1;
  }
  const next = `${candidate}-${suffix}`;
  usedIds.add(next);
  return next;
}

function toNodeBucket(nodeId: string, nodeBuckets: Map<string, NodeBucket>): NodeBucket {
  return nodeBuckets.get(nodeId) || 'unknown';
}

function selectLinksWithDiversity(
  links: LitigationDraftLink[],
  maxCount: number,
  resolveBucket: (link: LitigationDraftLink) => NodeBucket,
  bucketOrder: NodeBucket[],
): LinkSelectionResult {
  if (!Number.isFinite(maxCount) || maxCount <= 0 || links.length === 0) {
    const overflowByBucket = new Map<NodeBucket, number>();
    links.forEach((link) => {
      const bucket = resolveBucket(link);
      overflowByBucket.set(bucket, (overflowByBucket.get(bucket) || 0) + 1);
    });
    return {
      kept: [],
      overflowByBucket,
    };
  }

  if (links.length <= maxCount) {
    return {
      kept: [...links],
      overflowByBucket: new Map<NodeBucket, number>(),
    };
  }

  const queues = new Map<NodeBucket, LitigationDraftLink[]>();
  links.forEach((link) => {
    const bucket = resolveBucket(link);
    const current = queues.get(bucket) || [];
    current.push(link);
    queues.set(bucket, current);
  });

  const kept: LitigationDraftLink[] = [];
  let progressed = true;

  while (kept.length < maxCount && progressed) {
    progressed = false;
    bucketOrder.forEach((bucket) => {
      if (kept.length >= maxCount) {
        return;
      }
      const queue = queues.get(bucket);
      if (!queue || queue.length === 0) {
        return;
      }
      const next = queue.shift();
      if (!next) {
        return;
      }
      kept.push(next);
      progressed = true;
    });
  }

  const overflowByBucket = new Map<NodeBucket, number>();
  queues.forEach((queue, bucket) => {
    if (queue.length > 0) {
      overflowByBucket.set(bucket, queue.length);
    }
  });

  return {
    kept,
    overflowByBucket,
  };
}

function createAggregateEvidenceNode(
  evidence: LitigationDraftEvidence[],
  usedNodeIds: Set<string>,
  claimId: string,
  count: number,
): string {
  const id = ensureUniqueId(`aggregate-evidence-${claimId}`, usedNodeIds);
  evidence.push({
    id,
    label: `+${count} more evidence`,
    citation: `Summary mode collapsed ${pluralize(count, 'linked exhibit')}.`,
  });
  return id;
}

function createAggregateWitnessNode(
  witnesses: LitigationDraftWitness[],
  usedNodeIds: Set<string>,
  claimId: string,
  count: number,
): string {
  const id = ensureUniqueId(`aggregate-witness-${claimId}`, usedNodeIds);
  witnesses.push({
    id,
    name: `+${count} more witnesses`,
    quote: `Summary mode collapsed ${pluralize(count, 'witness statement')}.`,
  });
  return id;
}

function createAggregateTimelineNode(
  timeline: LitigationDraftTimelineEvent[],
  usedNodeIds: Set<string>,
  claimId: string,
  count: number,
): string {
  const id = ensureUniqueId(`aggregate-timeline-${claimId}`, usedNodeIds);
  timeline.push({
    id,
    dateLabel: 'Additional timeline events',
    event: `+${count} more timeline dependencies`,
  });
  return id;
}

function createAggregateClaimNode(
  claims: LitigationDraftClaim[],
  usedNodeIds: Set<string>,
  claimId: string,
  count: number,
): string {
  const id = ensureUniqueId(`aggregate-claim-${claimId}`, usedNodeIds);
  claims.push({
    id,
    title: `+${count} more linked claims`,
    summary: 'Summary mode collapsed additional claim relationships.',
  });
  return id;
}

function createAggregateNodeForBucket(
  bucket: NodeBucket,
  count: number,
  claimId: string,
  nodes: {
    claims: LitigationDraftClaim[];
    evidence: LitigationDraftEvidence[];
    witnesses: LitigationDraftWitness[];
    timeline: LitigationDraftTimelineEvent[];
  },
  usedNodeIds: Set<string>,
): string {
  if (bucket === 'evidence') {
    return createAggregateEvidenceNode(nodes.evidence, usedNodeIds, claimId, count);
  }
  if (bucket === 'witness') {
    return createAggregateWitnessNode(nodes.witnesses, usedNodeIds, claimId, count);
  }
  if (bucket === 'timeline') {
    return createAggregateTimelineNode(nodes.timeline, usedNodeIds, claimId, count);
  }
  if (bucket === 'claim') {
    return createAggregateClaimNode(nodes.claims, usedNodeIds, claimId, count);
  }
  return createAggregateEvidenceNode(nodes.evidence, usedNodeIds, claimId, count);
}

function createAggregateReason(
  relation: LitigationDraftLink['relation'],
  bucket: NodeBucket,
  count: number,
): string {
  const bucketLabel =
    bucket === 'timeline' ? 'timeline events' : bucket === 'unknown' ? 'linked items' : `${bucket} items`;
  return `Summary mode collapsed ${pluralize(count, bucketLabel)} for ${relation} links.`;
}

export function condenseLitigationDraftForLayout(
  draft: LitigationIntakeDraft,
  options: CondenseOptions = {},
): LitigationIntakeDraft {
  const mode = options.mode || DEFAULT_LAYOUT_MODE;
  const objective = options.objective || DEFAULT_OBJECTIVE;
  const dedupedLinks = dedupeLinks(draft.links);

  if (mode === 'expanded') {
    return {
      ...draft,
      links: dedupedLinks,
    };
  }

  const limits = OBJECTIVE_LIMITS[objective] || OBJECTIVE_LIMITS[DEFAULT_OBJECTIVE];
  const claimIds = new Set(draft.claims.map((claim) => claim.id));
  if (claimIds.size === 0) {
    return {
      ...draft,
      links: dedupedLinks,
    };
  }

  const claims = [...draft.claims];
  const evidence = [...draft.evidence];
  const witnesses = [...draft.witnesses];
  const timeline = [...draft.timeline];

  const usedNodeIds = new Set<string>([
    ...claims.map((entry) => entry.id),
    ...evidence.map((entry) => entry.id),
    ...witnesses.map((entry) => entry.id),
    ...timeline.map((entry) => entry.id),
  ]);

  const nodeBuckets = new Map<string, NodeBucket>();
  claims.forEach((entry) => nodeBuckets.set(entry.id, 'claim'));
  evidence.forEach((entry) => nodeBuckets.set(entry.id, 'evidence'));
  witnesses.forEach((entry) => nodeBuckets.set(entry.id, 'witness'));
  timeline.forEach((entry) => nodeBuckets.set(entry.id, 'timeline'));

  const incomingByClaim = new Map<string, Record<ClaimIncomingRelation, LitigationDraftLink[]>>();
  const outgoingDependsByClaim = new Map<string, LitigationDraftLink[]>();
  const passthrough: LitigationDraftLink[] = [];

  dedupedLinks.forEach((link) => {
    if (
      claimIds.has(link.toId) &&
      (link.relation === 'supports' || link.relation === 'contradicts')
    ) {
      const existing = incomingByClaim.get(link.toId) || {
        supports: [],
        contradicts: [],
      };
      existing[link.relation].push(link);
      incomingByClaim.set(link.toId, existing);
      return;
    }

    if (claimIds.has(link.fromId) && link.relation === 'depends_on') {
      const existing = outgoingDependsByClaim.get(link.fromId) || [];
      existing.push(link);
      outgoingDependsByClaim.set(link.fromId, existing);
      return;
    }

    passthrough.push(link);
  });

  const summaryLinks: LitigationDraftLink[] = [];

  const processIncomingRelation = (
    claimId: string,
    relation: ClaimIncomingRelation,
    maxCount: number,
  ) => {
    const links = incomingByClaim.get(claimId)?.[relation] || [];
    const selection = selectLinksWithDiversity(
      links,
      maxCount,
      (link) => toNodeBucket(link.fromId, nodeBuckets),
      INCOMING_BUCKET_ORDER,
    );
    summaryLinks.push(...selection.kept);

    selection.overflowByBucket.forEach((count, bucket) => {
      if (count <= 0) {
        return;
      }
      const aggregateId = createAggregateNodeForBucket(
        bucket,
        count,
        claimId,
        { claims, evidence, witnesses, timeline },
        usedNodeIds,
      );
      nodeBuckets.set(aggregateId, bucket === 'unknown' ? 'evidence' : bucket);
      summaryLinks.push({
        fromId: aggregateId,
        toId: claimId,
        relation,
        reason: createAggregateReason(relation, bucket, count),
      });
    });
  };

  const processOutgoingDepends = (claimId: string, maxCount: number) => {
    const links = outgoingDependsByClaim.get(claimId) || [];
    const selection = selectLinksWithDiversity(
      links,
      maxCount,
      (link) => toNodeBucket(link.toId, nodeBuckets),
      OUTGOING_BUCKET_ORDER,
    );
    summaryLinks.push(...selection.kept);

    selection.overflowByBucket.forEach((count, bucket) => {
      if (count <= 0) {
        return;
      }
      const aggregateId = createAggregateNodeForBucket(
        bucket,
        count,
        claimId,
        { claims, evidence, witnesses, timeline },
        usedNodeIds,
      );
      nodeBuckets.set(aggregateId, bucket === 'unknown' ? 'evidence' : bucket);
      summaryLinks.push({
        fromId: claimId,
        toId: aggregateId,
        relation: 'depends_on',
        reason: createAggregateReason('depends_on', bucket, count),
      });
    });
  };

  draft.claims.forEach((claim) => {
    processIncomingRelation(claim.id, 'supports', limits.supports);
    processIncomingRelation(claim.id, 'contradicts', limits.contradicts);
    processOutgoingDepends(claim.id, limits.depends_on);
  });

  return {
    claims,
    evidence,
    witnesses,
    timeline,
    links: [...summaryLinks, ...passthrough],
  };
}
