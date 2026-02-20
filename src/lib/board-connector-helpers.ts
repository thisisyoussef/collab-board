// Connector interaction helpers — snap-to-anchor, attachment detection, obstacle routing.
// Extracted from Board.tsx to keep the main page file manageable.
// These operate on a Map<string, BoardObject> (the live objects map) and are called
// during connector drag, hover, and rendering to resolve geometry and snapping.
import type { BoardObject } from '../types/board';
import type {
  ConnectorAnchorIgnore,
  ConnectorAttachmentCandidate,
  ConnectorAttachmentResult,
} from '../types/board-canvas';
import {
  CONNECTOR_PERIMETER_SNAP_DISTANCE_PX,
  CONNECTOR_ROUTING_CLEARANCE_PX,
  CONNECTOR_ROUTING_TURN_PENALTY,
  CONNECTOR_SNAP_DISTANCE_PX,
  CONNECTOR_SNAP_RELEASE_BUFFER_PX,
  SHAPE_ANCHOR_MATCH_EPSILON,
} from './board-constants';
import {
  getConnectorEndpoints,
  type ConnectorObstacle,
  type ConnectorPathType,
} from './connector-routing';
import {
  CONNECTOR_DEFAULT_END_ARROW,
  CONNECTOR_DEFAULT_PATH_TYPE,
  CONNECTOR_DEFAULT_START_ARROW,
  CONNECTOR_DEFAULT_STROKE_STYLE,
  getObjectBounds,
  getObjectSideAnchorCandidates,
  projectPointToObjectPerimeter,
  resolveConnectorPoints,
  resolveObjectAnchorPoint,
} from './board-object';

// ---------------------------------------------------------------------------
// Pure helpers – no external state needed
// ---------------------------------------------------------------------------

export function getConnectorPoints(connector: BoardObject): [number, number, number, number] {
  const points = connector.points || [connector.x, connector.y, connector.x + connector.width, connector.y];
  const endpoints = getConnectorEndpoints(points);
  return [endpoints.startX, endpoints.startY, endpoints.endX, endpoints.endY];
}

export function getConnectorPathType(entry: BoardObject): ConnectorPathType {
  if (entry.connectorType === 'bent' || entry.connectorType === 'curved' || entry.connectorType === 'straight') {
    return entry.connectorType;
  }
  return CONNECTOR_DEFAULT_PATH_TYPE;
}

export function getConnectorStrokeStyle(entry: BoardObject): 'solid' | 'dashed' {
  if (entry.strokeStyle === 'solid' || entry.strokeStyle === 'dashed') {
    return entry.strokeStyle;
  }
  return entry.style === 'dashed' ? 'dashed' : CONNECTOR_DEFAULT_STROKE_STYLE;
}

export function getConnectorArrowHead(
  entry: BoardObject,
  endpoint: 'start' | 'end',
): 'none' | 'solid' | 'line' | 'triangle' | 'diamond' {
  const fallback = endpoint === 'start' ? CONNECTOR_DEFAULT_START_ARROW : CONNECTOR_DEFAULT_END_ARROW;
  const value = endpoint === 'start' ? entry.startArrow : entry.endArrow;
  if (value === 'none' || value === 'solid' || value === 'line' || value === 'triangle' || value === 'diamond') {
    return value;
  }
  if (endpoint === 'end' && entry.style === 'arrow') {
    return 'solid' as const;
  }
  return fallback;
}

export function isConnectorDashed(entry: BoardObject): boolean {
  return getConnectorStrokeStyle(entry) === 'dashed';
}

export function getConnectorPathBounds(points: number[]): { width: number; height: number } {
  const sanitized = points.length >= 4 ? points : [0, 0, 120, 0];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let index = 0; index < sanitized.length - 1; index += 2) {
    xs.push(sanitized[index]);
    ys.push(sanitized[index + 1]);
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    width: Math.max(1, Math.abs(maxX - minX)),
    height: Math.max(1, Math.abs(maxY - minY)),
  };
}

// ---------------------------------------------------------------------------
// Pure helpers that take an object directly
// ---------------------------------------------------------------------------

export function findClosestAnchorForObject(
  entry: BoardObject,
  point: { x: number; y: number },
  mode: 'side-center' | 'arbitrary',
): ConnectorAttachmentCandidate | null {
  if (mode === 'arbitrary') {
    const projected = projectPointToObjectPerimeter(entry, point);
    const bounds = getObjectBounds(entry);
    const insideBounds =
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height;
    return {
      objectId: entry.id,
      x: projected.x,
      y: projected.y,
      anchorX: projected.anchorX,
      anchorY: projected.anchorY,
      distance: insideBounds ? 0 : Math.hypot(point.x - projected.x, point.y - projected.y),
      attachmentMode: 'arbitrary',
    };
  }

  const candidates = getObjectSideAnchorCandidates(entry);
  if (candidates.length === 0) {
    return null;
  }

  let best: ConnectorAttachmentCandidate | null = null;
  candidates.forEach((candidate) => {
    const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
    if (!best || distance < best.distance) {
      best = {
        objectId: entry.id,
        x: candidate.x,
        y: candidate.y,
        anchorX: candidate.anchorX,
        anchorY: candidate.anchorY,
        distance,
        attachmentMode: 'side-center',
      };
    }
  });

  return best;
}

export function isSameConnectorAnchor(
  anchorA: ConnectorAnchorIgnore,
  anchorB: ConnectorAnchorIgnore,
): boolean {
  return (
    anchorA.objectId === anchorB.objectId &&
    Math.abs(anchorA.anchorX - anchorB.anchorX) <= SHAPE_ANCHOR_MATCH_EPSILON &&
    Math.abs(anchorA.anchorY - anchorB.anchorY) <= SHAPE_ANCHOR_MATCH_EPSILON
  );
}

// ---------------------------------------------------------------------------
// Helpers that operate over an objects map (passed as parameter)
// ---------------------------------------------------------------------------

export function getConnectorRoutingObstacles(
  objects: Map<string, BoardObject>,
  connector: BoardObject,
): ConnectorObstacle[] {
  const obstacles: ConnectorObstacle[] = [];
  objects.forEach((entry) => {
    if (entry.id === connector.id || entry.type === 'connector') {
      return;
    }
    if (entry.id === connector.fromId || entry.id === connector.toId) {
      return;
    }

    const bounds = getObjectBounds(entry);
    obstacles.push({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    });
  });
  return obstacles;
}

export function resolveConnectorRenderPoints(
  objects: Map<string, BoardObject>,
  connector: BoardObject,
  fallbackPoints: number[],
): number[] {
  const from = connector.fromId ? objects.get(connector.fromId) : undefined;
  const to = connector.toId ? objects.get(connector.toId) : undefined;
  return resolveConnectorPoints({
    from,
    to,
    fromAnchorX: connector.fromAnchorX,
    fromAnchorY: connector.fromAnchorY,
    toAnchorX: connector.toAnchorX,
    toAnchorY: connector.toAnchorY,
    connectorType: getConnectorPathType(connector),
    pathControlX: connector.pathControlX,
    pathControlY: connector.pathControlY,
    curveOffset: connector.curveOffset,
    obstacles: getConnectorRoutingObstacles(objects, connector),
    clearance: CONNECTOR_ROUTING_CLEARANCE_PX,
    turnPenalty: CONNECTOR_ROUTING_TURN_PENALTY,
    fallback: fallbackPoints,
  });
}

export function findConnectorAttachment(
  objects: Map<string, BoardObject>,
  stageScale: number,
  worldPosition: { x: number; y: number },
  connectorId: string,
  mode: 'side-center' | 'arbitrary' = 'side-center',
  ignoreAnchor?: ConnectorAnchorIgnore,
  currentAnchor?: ConnectorAnchorIgnore,
  targetObjectId?: string,
): ConnectorAttachmentResult | null {
  const snapDistance = targetObjectId
    ? Number.POSITIVE_INFINITY
    : (mode === 'arbitrary' ? CONNECTOR_PERIMETER_SNAP_DISTANCE_PX : CONNECTOR_SNAP_DISTANCE_PX) /
        Math.max(0.1, stageScale);
  const snapReleaseDistance =
    ((mode === 'arbitrary' ? CONNECTOR_PERIMETER_SNAP_DISTANCE_PX : CONNECTOR_SNAP_DISTANCE_PX) +
      CONNECTOR_SNAP_RELEASE_BUFFER_PX) /
    Math.max(0.1, stageScale);

  if (
    currentAnchor &&
    (!ignoreAnchor || !isSameConnectorAnchor(currentAnchor, ignoreAnchor))
  ) {
    const currentObject = objects.get(currentAnchor.objectId);
    if (currentObject && currentObject.type !== 'connector') {
      const currentPoint = resolveObjectAnchorPoint(
        currentObject,
        currentAnchor.anchorX,
        currentAnchor.anchorY,
      );
      const distance = Math.hypot(
        worldPosition.x - currentPoint.x,
        worldPosition.y - currentPoint.y,
      );
      if (distance <= snapReleaseDistance) {
        return {
          objectId: currentAnchor.objectId,
          x: currentPoint.x,
          y: currentPoint.y,
          anchorX: currentAnchor.anchorX,
          anchorY: currentAnchor.anchorY,
          attachmentMode: mode,
        };
      }
    }
  }

  let bestMatch: ConnectorAttachmentCandidate | null = null;

  objects.forEach((entry) => {
    if (entry.id === connectorId || entry.type === 'connector') {
      return;
    }
    if (targetObjectId && entry.id !== targetObjectId) {
      return;
    }

    const candidate = findClosestAnchorForObject(entry, worldPosition, mode);
    if (!candidate || candidate.distance > snapDistance) {
      return;
    }

    if (
      ignoreAnchor &&
      isSameConnectorAnchor(ignoreAnchor, {
        objectId: candidate.objectId,
        anchorX: candidate.anchorX,
        anchorY: candidate.anchorY,
      })
    ) {
      return;
    }

    if (!bestMatch || candidate.distance < bestMatch.distance) {
      bestMatch = candidate;
    }
  });

  if (!bestMatch) {
    return null;
  }

  const { objectId, x, y, anchorX, anchorY, attachmentMode } = bestMatch;
  return { objectId, x, y, anchorX, anchorY, attachmentMode };
}

export function findHoveredShapeId(
  objects: Map<string, BoardObject>,
  worldPosition: { x: number; y: number },
  connectorId: string,
): string | null {
  let hovered: string | null = null;
  objects.forEach((entry) => {
    if (hovered || entry.id === connectorId || entry.type === 'connector') {
      return;
    }
    const bounds = getObjectBounds(entry);
    const withinX = worldPosition.x >= bounds.x && worldPosition.x <= bounds.x + bounds.width;
    const withinY = worldPosition.y >= bounds.y && worldPosition.y <= bounds.y + bounds.height;
    if (withinX && withinY) {
      hovered = entry.id;
    }
  });
  return hovered;
}
