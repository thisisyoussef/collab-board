import type { AIActionPreview } from '../types/ai';
import type {
  LitigationIntakeDraft,
  LitigationIntakeObjective,
  LitigationLayoutMode,
} from '../types/litigation';
import { condenseLitigationDraftForLayout } from './litigation-graph-condense';

interface BuildBoardActionsFromDraftResult {
  actions: AIActionPreview[];
  message: string;
}

interface BuildBoardActionsFromDraftOptions {
  existingObjectIds?: Iterable<string>;
  objective?: LitigationIntakeObjective;
  layoutMode?: LitigationLayoutMode;
}

interface CardContentOptions {
  compact: boolean;
}

type LaneKey = 'claims' | 'evidence' | 'witnesses' | 'timeline';

interface LanePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LaneCardLayout {
  columns: number;
  rows: number;
  cardWidth: number;
  frameHeight: number;
}

type ObjectiveLaneOrder = [LaneKey, LaneKey, LaneKey, LaneKey];

const LANE_META: Record<
  LaneKey,
  { title: string; color: string; nodeRole: 'claim' | 'evidence' | 'witness' | 'timeline_event' }
> = {
  claims: { title: 'Claims', color: '#DCE8FF', nodeRole: 'claim' },
  evidence: { title: 'Evidence', color: '#E1F4E5', nodeRole: 'evidence' },
  witnesses: { title: 'Witnesses', color: '#F4E6FF', nodeRole: 'witness' },
  timeline: { title: 'Timeline', color: '#FFF1D6', nodeRole: 'timeline_event' },
} as const;

const BOARD_LAYOUT = {
  startX: 80,
  startY: 80,
  laneWidth: 460,
  laneGapX: 64,
  laneGapY: 72,
  frameMinHeight: 320,
  frameHeaderOffset: 72,
  frameBottomPadding: 24,
  lanePaddingX: 24,
  rowGapY: 16,
  columnGapX: 16,
  cardHeight: 102,
  twoColumnThreshold: 7,
  showConnectorLabelsMaxLinks: 10,
  showConnectorLabelsMaxNodes: 16,
} as const;

const OBJECTIVE_LANE_ORDERS: Record<LitigationIntakeObjective, ObjectiveLaneOrder> = {
  board_overview: ['claims', 'evidence', 'witnesses', 'timeline'],
  chronology: ['timeline', 'claims', 'evidence', 'witnesses'],
  contradictions: ['witnesses', 'claims', 'evidence', 'timeline'],
  witness_prep: ['witnesses', 'evidence', 'claims', 'timeline'],
};

function shortenLine(line: string, limit = 96): string {
  const cleaned = line.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= limit) {
    return cleaned;
  }
  return `${cleaned.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
}

function toStickyText(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => shortenLine(line))
    .filter(Boolean);

  const limitedLines = lines.slice(0, 4);
  let text = limitedLines.join('\n').slice(0, 300);
  if (lines.length > limitedLines.length) {
    text = `${text}\n…`;
  }
  return text || shortenLine(raw, 120);
}

function createLaneCardLayout(itemCount: number): LaneCardLayout {
  const columns = itemCount >= BOARD_LAYOUT.twoColumnThreshold ? 2 : 1;
  const rows = Math.max(1, Math.ceil(Math.max(itemCount, 1) / columns));
  const cardWidth =
    columns === 1
      ? BOARD_LAYOUT.laneWidth - BOARD_LAYOUT.lanePaddingX * 2
      : Math.floor(
          (BOARD_LAYOUT.laneWidth -
            BOARD_LAYOUT.lanePaddingX * 2 -
            BOARD_LAYOUT.columnGapX) /
            columns,
        );

  const cardsHeight =
    rows * BOARD_LAYOUT.cardHeight + (rows - 1) * BOARD_LAYOUT.rowGapY;
  const frameHeight = Math.max(
    BOARD_LAYOUT.frameMinHeight,
    BOARD_LAYOUT.frameHeaderOffset + cardsHeight + BOARD_LAYOUT.frameBottomPadding,
  );

  return {
    columns,
    rows,
    cardWidth,
    frameHeight,
  };
}

function createLanePlacements(
  layouts: Record<LaneKey, LaneCardLayout>,
  objective: LitigationIntakeObjective,
): Record<LaneKey, LanePlacement> {
  const [topLeftLane, topRightLane, bottomLeftLane, bottomRightLane] =
    OBJECTIVE_LANE_ORDERS[objective];
  const topHeight = Math.max(layouts[topLeftLane].frameHeight, layouts[topRightLane].frameHeight);
  const bottomHeight = Math.max(
    layouts[bottomLeftLane].frameHeight,
    layouts[bottomRightLane].frameHeight,
  );
  const rightX = BOARD_LAYOUT.startX + BOARD_LAYOUT.laneWidth + BOARD_LAYOUT.laneGapX;
  const bottomY = BOARD_LAYOUT.startY + topHeight + BOARD_LAYOUT.laneGapY;

  const placements: Record<LaneKey, LanePlacement> = {
    claims: { x: BOARD_LAYOUT.startX, y: BOARD_LAYOUT.startY, width: BOARD_LAYOUT.laneWidth, height: topHeight },
    evidence: { x: rightX, y: BOARD_LAYOUT.startY, width: BOARD_LAYOUT.laneWidth, height: topHeight },
    witnesses: { x: BOARD_LAYOUT.startX, y: bottomY, width: BOARD_LAYOUT.laneWidth, height: bottomHeight },
    timeline: { x: rightX, y: bottomY, width: BOARD_LAYOUT.laneWidth, height: bottomHeight },
  };

  const assignPlacement = (
    lane: LaneKey,
    x: number,
    y: number,
    rowHeight: number,
  ): void => {
    placements[lane] = {
      x,
      y,
      width: BOARD_LAYOUT.laneWidth,
      height: rowHeight,
    };
  };

  assignPlacement(topLeftLane, BOARD_LAYOUT.startX, BOARD_LAYOUT.startY, topHeight);
  assignPlacement(topRightLane, rightX, BOARD_LAYOUT.startY, topHeight);
  assignPlacement(bottomLeftLane, BOARD_LAYOUT.startX, bottomY, bottomHeight);
  assignPlacement(bottomRightLane, rightX, bottomY, bottomHeight);

  return placements;
}

function laneItemPosition(
  lane: LanePlacement,
  laneLayout: LaneCardLayout,
  index: number,
): { x: number; y: number } {
  const column = index % laneLayout.columns;
  const row = Math.floor(index / laneLayout.columns);
  return {
    x:
      lane.x +
      BOARD_LAYOUT.lanePaddingX +
      column * (laneLayout.cardWidth + BOARD_LAYOUT.columnGapX),
    y:
      lane.y +
      BOARD_LAYOUT.frameHeaderOffset +
      row * (BOARD_LAYOUT.cardHeight + BOARD_LAYOUT.rowGapY),
  };
}

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
  width: number,
  height: number,
  nodeRole: 'claim' | 'evidence' | 'witness' | 'timeline_event',
): AIActionPreview {
  return {
    id: `sticky-${id}`,
    name: 'createStickyNote',
    summary: `text=${text.slice(0, 28)} · x=${x} · y=${y}`,
    input: {
      objectId: id,
      text: toStickyText(text),
      x,
      y,
      color,
      width,
      height,
      nodeRole,
    },
  };
}

function createConnectorAction(
  id: string,
  fromId: string,
  toId: string,
  relation: 'supports' | 'contradicts' | 'depends_on',
  options: {
    showLabel: boolean;
    curved: boolean;
  },
  reason?: string,
): AIActionPreview {
  const strokeStyle = relation === 'contradicts' ? 'dashed' : 'solid';
  const shortReason = reason ? shortenLine(reason, 52) : '';
  const label = options.showLabel ? (shortReason ? `${relation}: ${shortReason}` : relation) : undefined;
  return {
    id: `connector-${id}`,
    name: 'createConnector',
    summary: `${relation} ${fromId} -> ${toId}`,
    input: {
      objectId: id,
      fromId,
      toId,
      ...(label ? { label } : {}),
      relationType: relation,
      strokeStyle,
      endArrow: 'solid',
      connectorType: options.curved ? 'curved' : 'straight',
    },
  };
}

function buildClaimCardText(
  claim: LitigationIntakeDraft['claims'][number],
  options: CardContentOptions,
): string {
  if (options.compact || !claim.summary) {
    return claim.title;
  }
  return `${claim.title}\n${claim.summary}`;
}

function buildEvidenceCardText(
  evidence: LitigationIntakeDraft['evidence'][number],
  options: CardContentOptions,
): string {
  if (options.compact || !evidence.citation) {
    return evidence.label;
  }
  return `${evidence.label}\n${evidence.citation}`;
}

function buildWitnessCardText(
  witness: LitigationIntakeDraft['witnesses'][number],
  options: CardContentOptions,
): string {
  if (options.compact) {
    return witness.name;
  }
  const quote = witness.quote ? `\n"${witness.quote}"` : '';
  const citation = witness.citation ? `\n${witness.citation}` : '';
  return `${witness.name}${quote}${citation}`;
}

function buildTimelineCardText(
  timelineEvent: LitigationIntakeDraft['timeline'][number],
  options: CardContentOptions,
): string {
  if (options.compact) {
    return timelineEvent.dateLabel;
  }
  return `${timelineEvent.dateLabel}\n${timelineEvent.event}`;
}

export function buildBoardActionsFromLitigationDraft(
  draft: LitigationIntakeDraft,
  options: BuildBoardActionsFromDraftOptions = {},
): BuildBoardActionsFromDraftResult {
  const objective = options.objective || 'board_overview';
  const layoutMode = options.layoutMode || 'summary';
  const cardContentOptions: CardContentOptions = {
    compact: layoutMode === 'summary',
  };
  const layoutDraft = condenseLitigationDraftForLayout(draft, {
    mode: layoutMode,
    objective,
  });
  const usedIds = new Set<string>(options.existingObjectIds || []);
  const actions: AIActionPreview[] = [];

  const hasContent =
    layoutDraft.claims.length > 0 ||
    layoutDraft.evidence.length > 0 ||
    layoutDraft.witnesses.length > 0 ||
    layoutDraft.timeline.length > 0;
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

  const laneLayouts: Record<LaneKey, LaneCardLayout> = {
    claims: createLaneCardLayout(layoutDraft.claims.length),
    evidence: createLaneCardLayout(layoutDraft.evidence.length),
    witnesses: createLaneCardLayout(layoutDraft.witnesses.length),
    timeline: createLaneCardLayout(layoutDraft.timeline.length),
  };
  const lanePlacements = createLanePlacements(laneLayouts, objective);

  actions.push(
    createFrameAction(
      frameIds.claims,
      LANE_META.claims.title,
      lanePlacements.claims.x,
      lanePlacements.claims.y,
      lanePlacements.claims.width,
      lanePlacements.claims.height,
    ),
    createFrameAction(
      frameIds.evidence,
      LANE_META.evidence.title,
      lanePlacements.evidence.x,
      lanePlacements.evidence.y,
      lanePlacements.evidence.width,
      lanePlacements.evidence.height,
    ),
    createFrameAction(
      frameIds.witnesses,
      LANE_META.witnesses.title,
      lanePlacements.witnesses.x,
      lanePlacements.witnesses.y,
      lanePlacements.witnesses.width,
      lanePlacements.witnesses.height,
    ),
    createFrameAction(
      frameIds.timeline,
      LANE_META.timeline.title,
      lanePlacements.timeline.x,
      lanePlacements.timeline.y,
      lanePlacements.timeline.width,
      lanePlacements.timeline.height,
    ),
  );

  const idMap = new Map<string, string>();

  layoutDraft.claims.forEach((claim, index) => {
    const objectId = ensureUniqueId(claim.id || `claim-${index + 1}`, usedIds);
    idMap.set(claim.id, objectId);
    const position = laneItemPosition(lanePlacements.claims, laneLayouts.claims, index);
    actions.push(
      createStickyAction(
        objectId,
        buildClaimCardText(claim, cardContentOptions),
        position.x,
        position.y,
        LANE_META.claims.color,
        laneLayouts.claims.cardWidth,
        BOARD_LAYOUT.cardHeight,
        LANE_META.claims.nodeRole,
      ),
    );
  });

  layoutDraft.evidence.forEach((evidence, index) => {
    const objectId = ensureUniqueId(evidence.id || `evidence-${index + 1}`, usedIds);
    idMap.set(evidence.id, objectId);
    const position = laneItemPosition(lanePlacements.evidence, laneLayouts.evidence, index);
    actions.push(
      createStickyAction(
        objectId,
        buildEvidenceCardText(evidence, cardContentOptions),
        position.x,
        position.y,
        LANE_META.evidence.color,
        laneLayouts.evidence.cardWidth,
        BOARD_LAYOUT.cardHeight,
        LANE_META.evidence.nodeRole,
      ),
    );
  });

  layoutDraft.witnesses.forEach((witness, index) => {
    const objectId = ensureUniqueId(witness.id || `witness-${index + 1}`, usedIds);
    idMap.set(witness.id, objectId);
    const position = laneItemPosition(lanePlacements.witnesses, laneLayouts.witnesses, index);
    actions.push(
      createStickyAction(
        objectId,
        buildWitnessCardText(witness, cardContentOptions),
        position.x,
        position.y,
        LANE_META.witnesses.color,
        laneLayouts.witnesses.cardWidth,
        BOARD_LAYOUT.cardHeight,
        LANE_META.witnesses.nodeRole,
      ),
    );
  });

  layoutDraft.timeline.forEach((timelineEvent, index) => {
    const objectId = ensureUniqueId(timelineEvent.id || `timeline-${index + 1}`, usedIds);
    idMap.set(timelineEvent.id, objectId);
    const position = laneItemPosition(lanePlacements.timeline, laneLayouts.timeline, index);
    actions.push(
      createStickyAction(
        objectId,
        buildTimelineCardText(timelineEvent, cardContentOptions),
        position.x,
        position.y,
        LANE_META.timeline.color,
        laneLayouts.timeline.cardWidth,
        BOARD_LAYOUT.cardHeight,
        LANE_META.timeline.nodeRole,
      ),
    );
  });

  const totalNodes =
    layoutDraft.claims.length +
    layoutDraft.evidence.length +
    layoutDraft.witnesses.length +
    layoutDraft.timeline.length;
  const showConnectorLabels =
    layoutDraft.links.length <= BOARD_LAYOUT.showConnectorLabelsMaxLinks &&
    totalNodes <= BOARD_LAYOUT.showConnectorLabelsMaxNodes;
  const useCurvedConnectors = layoutDraft.links.length >= 8 || totalNodes >= 16;
  const seenLinkKeys = new Set<string>();

  layoutDraft.links.forEach((link, index) => {
    const fromId = idMap.get(link.fromId) || link.fromId;
    const toId = idMap.get(link.toId) || link.toId;
    if (!fromId || !toId) {
      return;
    }

    const dedupeKey = `${fromId}::${toId}::${link.relation}`;
    if (seenLinkKeys.has(dedupeKey)) {
      return;
    }
    seenLinkKeys.add(dedupeKey);

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
        {
          showLabel: showConnectorLabels,
          curved: useCurvedConnectors,
        },
        link.reason,
      ),
    );
  });

  return {
    actions,
    message: `Generated litigation board draft with ${layoutDraft.claims.length} claims, ${layoutDraft.evidence.length} evidence items, ${layoutDraft.witnesses.length} witnesses, and ${layoutDraft.timeline.length} timeline events.`,
  };
}
