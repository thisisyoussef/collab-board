import type {
  BoardObject,
  LitigationConnectorRelation,
  LitigationNodeRole,
} from '../types/board';

const SUPPORT_SOURCE_ROLES = new Set<LitigationNodeRole>(['evidence', 'witness', 'timeline_event']);

function isLitigationNodeRole(value: unknown): value is LitigationNodeRole {
  return value === 'claim' || value === 'evidence' || value === 'witness' || value === 'timeline_event';
}

function isLitigationRelation(value: unknown): value is LitigationConnectorRelation {
  return value === 'supports' || value === 'contradicts' || value === 'depends_on';
}

function parseRelation(entry: BoardObject): LitigationConnectorRelation | null {
  if (isLitigationRelation(entry.relationType)) {
    return entry.relationType;
  }

  const normalizedLabel = String(entry.label || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (isLitigationRelation(normalizedLabel)) {
    return normalizedLabel;
  }
  if (normalizedLabel === 'depends_on') {
    return 'depends_on';
  }

  return null;
}

function pluralize(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? '' : 's'}`;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export interface LitigationGraphEdge {
  id: string;
  fromId: string;
  toId: string;
  relation: LitigationConnectorRelation;
}

export interface LitigationGraphData {
  claimIds: string[];
  edges: LitigationGraphEdge[];
}

export interface ClaimStrengthResult {
  claimId: string;
  claimLabel: string;
  score: number;
  level: 'strong' | 'medium' | 'weak';
  supportCount: number;
  contradictionCount: number;
  dependencyGapCount: number;
  reasons: string[];
}

export function extractLitigationGraph(objects: Iterable<BoardObject>): LitigationGraphData {
  const allObjects = Array.from(objects);
  const claimIds = allObjects
    .filter((entry) => entry.type !== 'connector' && entry.nodeRole === 'claim')
    .map((entry) => entry.id)
    .sort((a, b) => a.localeCompare(b));

  const edges = allObjects
    .filter((entry) => entry.type === 'connector')
    .map((entry) => {
      const relation = parseRelation(entry);
      const fromId = typeof entry.fromId === 'string' ? entry.fromId.trim() : '';
      const toId = typeof entry.toId === 'string' ? entry.toId.trim() : '';
      if (!relation || !fromId || !toId) {
        return null;
      }
      return {
        id: entry.id,
        fromId,
        toId,
        relation,
      } satisfies LitigationGraphEdge;
    })
    .filter((entry): entry is LitigationGraphEdge => Boolean(entry));

  return {
    claimIds,
    edges,
  };
}

function resolveClaimLabel(entry: BoardObject | undefined, claimId: string): string {
  if (!entry) {
    return claimId;
  }
  const text = typeof entry.text === 'string' ? entry.text.trim() : '';
  if (text) {
    return text.slice(0, 120);
  }
  const title = typeof entry.title === 'string' ? entry.title.trim() : '';
  if (title) {
    return title.slice(0, 120);
  }
  return claimId;
}

export function evaluateClaimStrength(objects: Iterable<BoardObject>): ClaimStrengthResult[] {
  const allObjects = Array.from(objects);
  const objectsById = new Map(allObjects.map((entry) => [entry.id, entry]));
  const graph = extractLitigationGraph(allObjects);

  return graph.claimIds.map((claimId) => {
    const supportCount = graph.edges.filter((edge) => {
      if (edge.toId !== claimId || edge.relation !== 'supports') {
        return false;
      }
      const source = objectsById.get(edge.fromId);
      return Boolean(source && source.type !== 'connector' && SUPPORT_SOURCE_ROLES.has(source.nodeRole as LitigationNodeRole));
    }).length;

    const contradictionCount = graph.edges.filter(
      (edge) => edge.toId === claimId && edge.relation === 'contradicts',
    ).length;

    const dependencyEdges = graph.edges.filter(
      (edge) => edge.fromId === claimId && edge.relation === 'depends_on',
    );
    const unresolvedDependencyCount =
      dependencyEdges.length === 0
        ? 1
        : dependencyEdges.filter((edge) => {
            const target = objectsById.get(edge.toId);
            if (!target || target.type === 'connector') {
              return true;
            }
            return !isLitigationNodeRole(target.nodeRole);
          }).length;

    const supportBonus = Math.min(40, supportCount * 10);
    const contradictionPenalty = Math.min(36, contradictionCount * 12);
    const dependencyPenalty = Math.min(30, unresolvedDependencyCount * 15);
    const score = clamp(50 + supportBonus - contradictionPenalty - dependencyPenalty, 0, 100);
    const level: ClaimStrengthResult['level'] =
      score >= 70 ? 'strong' : score >= 45 ? 'medium' : 'weak';

    const reasons: string[] = [];
    if (supportCount > 0) {
      reasons.push(`${pluralize(supportCount, 'support link')} from evidence, witness, or timeline nodes.`);
    } else {
      reasons.push('No supporting links from evidence, witness, or timeline nodes.');
    }
    if (contradictionCount > 0) {
      reasons.push(`${pluralize(contradictionCount, 'contradiction link')} found.`);
    }
    if (unresolvedDependencyCount > 0) {
      reasons.push(`${pluralize(unresolvedDependencyCount, 'unresolved dependency gap')}.`);
    } else if (dependencyEdges.length > 0) {
      reasons.push('All mapped dependencies resolve to tagged nodes.');
    }

    return {
      claimId,
      claimLabel: resolveClaimLabel(objectsById.get(claimId), claimId),
      score,
      level,
      supportCount,
      contradictionCount,
      dependencyGapCount: unresolvedDependencyCount,
      reasons,
    };
  });
}

export function claimStrengthColor(level: ClaimStrengthResult['level']): string {
  if (level === 'strong') {
    return '#1f8f5b';
  }
  if (level === 'medium') {
    return '#b9811b';
  }
  return '#c4453e';
}
