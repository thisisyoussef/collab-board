import type { AIActionPreview } from '../types/ai';
import type { LitigationIntakeDraft } from '../types/litigation';

interface BuildBoardActionsFromDraftResult {
  actions: AIActionPreview[];
  message: string;
}

interface BuildBoardActionsFromDraftOptions {
  existingObjectIds?: Iterable<string>;
}

const FRAME_LAYOUT = {
  claims: { title: 'Claims', x: 100, y: 100, width: 380, height: 320 },
  evidence: { title: 'Evidence', x: 520, y: 100, width: 380, height: 320 },
  witnesses: { title: 'Witnesses', x: 100, y: 460, width: 380, height: 320 },
  timeline: { title: 'Timeline', x: 520, y: 460, width: 380, height: 320 },
} as const;

const LANE_SPACING_Y = 96;
const LANE_PADDING_X = 40;
const LANE_PADDING_Y = 70;

const COLOR = {
  claim: '#DCE8FF',
  evidence: '#E1F4E5',
  witness: '#F4E6FF',
  timeline: '#FFF1D6',
} as const;

function slugify(value: string, fallbackPrefix: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || `${fallbackPrefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureUniqueId(baseId: string, used: Set<string>): string {
  const trimmed = baseId.trim() || 'item';
  if (!used.has(trimmed)) {
    used.add(trimmed);
    return trimmed;
  }

  let suffix = 2;
  while (used.has(`${trimmed}-${suffix}`)) {
    suffix += 1;
  }
  const nextId = `${trimmed}-${suffix}`;
  used.add(nextId);
  return nextId;
}

function createFrameAction(
  id: string,
  title: string,
  x: number,
  y: number,
  width: number,
  height: number,
): AIActionPreview {
  return {
    id: `frame-${id}`,
    name: 'createFrame',
    summary: `title=${title} · x=${x} · y=${y}`,
    input: { objectId: id, title, x, y, width, height },
  };
}

function createStickyAction(
  id: string,
  text: string,
  x: number,
  y: number,
  color: string,
): AIActionPreview {
  return {
    id: `sticky-${id}`,
    name: 'createStickyNote',
    summary: `text=${text.slice(0, 28)} · x=${x} · y=${y}`,
    input: {
      objectId: id,
      text,
      x,
      y,
      color,
      width: 220,
      height: 84,
    },
  };
}

function createConnectorAction(
  id: string,
  fromId: string,
  toId: string,
  relation: 'supports' | 'contradicts' | 'depends_on',
  reason?: string,
): AIActionPreview {
  const strokeStyle = relation === 'contradicts' ? 'dashed' : 'solid';
  return {
    id: `connector-${id}`,
    name: 'createConnector',
    summary: `${relation} ${fromId} -> ${toId}`,
    input: {
      objectId: id,
      fromId,
      toId,
      label: reason ? `${relation}: ${reason}` : relation,
      strokeStyle,
      endArrow: 'solid',
    },
  };
}

export function buildBoardActionsFromLitigationDraft(
  draft: LitigationIntakeDraft,
  options: BuildBoardActionsFromDraftOptions = {},
): BuildBoardActionsFromDraftResult {
  const usedIds = new Set<string>(options.existingObjectIds || []);
  const actions: AIActionPreview[] = [];

  const hasContent =
    draft.claims.length > 0 ||
    draft.evidence.length > 0 ||
    draft.witnesses.length > 0 ||
    draft.timeline.length > 0;
  if (!hasContent) {
    return {
      actions,
      message: 'No valid litigation entities were detected in the draft.',
    };
  }

  const frameIds = {
    claims: ensureUniqueId('intake-frame-claims', usedIds),
    evidence: ensureUniqueId('intake-frame-evidence', usedIds),
    witnesses: ensureUniqueId('intake-frame-witnesses', usedIds),
    timeline: ensureUniqueId('intake-frame-timeline', usedIds),
  };

  actions.push(
    createFrameAction(
      frameIds.claims,
      FRAME_LAYOUT.claims.title,
      FRAME_LAYOUT.claims.x,
      FRAME_LAYOUT.claims.y,
      FRAME_LAYOUT.claims.width,
      FRAME_LAYOUT.claims.height,
    ),
    createFrameAction(
      frameIds.evidence,
      FRAME_LAYOUT.evidence.title,
      FRAME_LAYOUT.evidence.x,
      FRAME_LAYOUT.evidence.y,
      FRAME_LAYOUT.evidence.width,
      FRAME_LAYOUT.evidence.height,
    ),
    createFrameAction(
      frameIds.witnesses,
      FRAME_LAYOUT.witnesses.title,
      FRAME_LAYOUT.witnesses.x,
      FRAME_LAYOUT.witnesses.y,
      FRAME_LAYOUT.witnesses.width,
      FRAME_LAYOUT.witnesses.height,
    ),
    createFrameAction(
      frameIds.timeline,
      FRAME_LAYOUT.timeline.title,
      FRAME_LAYOUT.timeline.x,
      FRAME_LAYOUT.timeline.y,
      FRAME_LAYOUT.timeline.width,
      FRAME_LAYOUT.timeline.height,
    ),
  );

  const idMap = new Map<string, string>();

  draft.claims.forEach((claim, index) => {
    const objectId = ensureUniqueId(claim.id || `claim-${index + 1}`, usedIds);
    idMap.set(claim.id, objectId);
    actions.push(
      createStickyAction(
        objectId,
        claim.summary ? `${claim.title}\n${claim.summary}` : claim.title,
        FRAME_LAYOUT.claims.x + LANE_PADDING_X,
        FRAME_LAYOUT.claims.y + LANE_PADDING_Y + index * LANE_SPACING_Y,
        COLOR.claim,
      ),
    );
  });

  draft.evidence.forEach((evidence, index) => {
    const objectId = ensureUniqueId(evidence.id || `evidence-${index + 1}`, usedIds);
    idMap.set(evidence.id, objectId);
    const text = evidence.citation ? `${evidence.label}\n${evidence.citation}` : evidence.label;
    actions.push(
      createStickyAction(
        objectId,
        text,
        FRAME_LAYOUT.evidence.x + LANE_PADDING_X,
        FRAME_LAYOUT.evidence.y + LANE_PADDING_Y + index * LANE_SPACING_Y,
        COLOR.evidence,
      ),
    );
  });

  draft.witnesses.forEach((witness, index) => {
    const objectId = ensureUniqueId(witness.id || `witness-${index + 1}`, usedIds);
    idMap.set(witness.id, objectId);
    const quote = witness.quote ? `\n"${witness.quote}"` : '';
    const citation = witness.citation ? `\n${witness.citation}` : '';
    actions.push(
      createStickyAction(
        objectId,
        `${witness.name}${quote}${citation}`,
        FRAME_LAYOUT.witnesses.x + LANE_PADDING_X,
        FRAME_LAYOUT.witnesses.y + LANE_PADDING_Y + index * LANE_SPACING_Y,
        COLOR.witness,
      ),
    );
  });

  draft.timeline.forEach((timelineEvent, index) => {
    const objectId = ensureUniqueId(timelineEvent.id || `timeline-${index + 1}`, usedIds);
    idMap.set(timelineEvent.id, objectId);
    actions.push(
      createStickyAction(
        objectId,
        `${timelineEvent.dateLabel}\n${timelineEvent.event}`,
        FRAME_LAYOUT.timeline.x + LANE_PADDING_X,
        FRAME_LAYOUT.timeline.y + LANE_PADDING_Y + index * LANE_SPACING_Y,
        COLOR.timeline,
      ),
    );
  });

  draft.links.forEach((link, index) => {
    const fromId = idMap.get(link.fromId) || link.fromId;
    const toId = idMap.get(link.toId) || link.toId;
    if (!fromId || !toId) {
      return;
    }

    const connectorId = ensureUniqueId(
      `${slugify(link.relation, 'relation')}-${slugify(fromId, 'from')}-${slugify(toId, 'to')}-${index + 1}`,
      usedIds,
    );

    actions.push(
      createConnectorAction(
        connectorId,
        fromId,
        toId,
        link.relation,
        link.reason,
      ),
    );
  });

  return {
    actions,
    message: `Generated litigation board draft with ${draft.claims.length} claims, ${draft.evidence.length} evidence items, ${draft.witnesses.length} witnesses, and ${draft.timeline.length} timeline events.`,
  };
}
