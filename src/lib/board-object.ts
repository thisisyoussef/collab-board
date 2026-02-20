import {
  buildConnectorRenderPoints,
  getConnectorEndpoints,
  type ConnectorObstacle,
  type ConnectorPathType as RouteConnectorPathType,
} from './connector-routing';
import type {
  BoardObject,
  BoardObjectStyle,
  BoardObjectType,
  ConnectorArrowHead,
  ConnectorAttachmentMode,
  ConnectorPathType,
  ConnectorStrokeStyle,
} from '../types/board';

export const STICKY_DEFAULT_WIDTH = 150;
export const STICKY_DEFAULT_HEIGHT = 100;
export const STICKY_DEFAULT_COLOR = '#F5D08E';
export const RECT_DEFAULT_COLOR = '#FAFAF8';
export const RECT_DEFAULT_STROKE = '#2A4A7F';
export const RECT_DEFAULT_STROKE_WIDTH = 2;
export const RECT_MIN_SIZE = 10;
export const STICKY_MIN_WIDTH = 48;
export const STICKY_MIN_HEIGHT = 36;
export const TEXT_DEFAULT_COLOR = '#1E1C19';
export const TEXT_DEFAULT_FONT_SIZE = 20;
export const TEXT_MIN_WIDTH = 72;
export const TEXT_MIN_HEIGHT = 28;
export const CIRCLE_DEFAULT_COLOR = '#F2F0EB';
export const LINE_DEFAULT_COLOR = '#2A4A7F';
export const FRAME_DEFAULT_STROKE = '#132D54';
export const FRAME_DEFAULT_FILL = '#F2F0EB';
export const FRAME_DEFAULT_TITLE = 'Frame';
export const FRAME_MIN_WIDTH = 220;
export const FRAME_MIN_HEIGHT = 140;
export const CONNECTOR_DEFAULT_COLOR = '#4A8FCC';
export const CONNECTOR_DEFAULT_STYLE: BoardObjectStyle = 'arrow';
export const CONNECTOR_DEFAULT_PATH_TYPE: ConnectorPathType = 'straight';
export const CONNECTOR_DEFAULT_STROKE_STYLE: ConnectorStrokeStyle = 'solid';
export const CONNECTOR_DEFAULT_START_ARROW: ConnectorArrowHead = 'none';
export const CONNECTOR_DEFAULT_END_ARROW: ConnectorArrowHead = 'solid';
export const CONNECTOR_DEFAULT_LABEL_POSITION = 50;
export const CONNECTOR_DEFAULT_LABEL_BACKGROUND = false;
const LINE_MIN_LENGTH = 8;
const EPSILON = 0.0001;

export interface DefaultBoardObjectFactory {
  createdBy: string;
  nowIso: string;
  nextZIndex: number;
}

export interface ApplyIncomingObjectInput {
  existing: BoardObject | undefined;
  incoming: BoardObject;
  eventTs?: number;
}

export interface ApplyIncomingObjectResult {
  shouldApply: boolean;
}

export interface ObjectAnchorPoint {
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
}

function isBoardObjectType(value: unknown): value is BoardObjectType {
  return (
    value === 'sticky' ||
    value === 'rect' ||
    value === 'circle' ||
    value === 'line' ||
    value === 'text' ||
    value === 'frame' ||
    value === 'connector'
  );
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function parseStyle(value: unknown): BoardObjectStyle {
  if (value === 'arrow' || value === 'line' || value === 'dashed') {
    return value;
  }
  return CONNECTOR_DEFAULT_STYLE;
}

function parseConnectorPathType(value: unknown): ConnectorPathType {
  if (value === 'straight' || value === 'bent' || value === 'curved') {
    return value;
  }
  return CONNECTOR_DEFAULT_PATH_TYPE;
}

function parseConnectorStrokeStyle(value: unknown, fallback: ConnectorStrokeStyle): ConnectorStrokeStyle {
  if (value === 'solid' || value === 'dashed') {
    return value;
  }
  return fallback;
}

function parseConnectorAttachmentMode(
  value: unknown,
  fallback: ConnectorAttachmentMode,
): ConnectorAttachmentMode {
  if (value === 'side-center' || value === 'arbitrary' || value === 'free') {
    return value;
  }
  return fallback;
}

function parseConnectorArrowHead(value: unknown, fallback: ConnectorArrowHead): ConnectorArrowHead {
  if (value === 'none' || value === 'solid' || value === 'line' || value === 'triangle' || value === 'diamond') {
    return value;
  }
  return fallback;
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

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function parseAnchor(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return clamp01(parsed);
}

function parsePoints(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const next = value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));

  if (next.length < 4) {
    return fallback;
  }

  return next.slice(0, Math.max(4, next.length - (next.length % 2)));
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry)) as T;
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entryValue]) => {
      if (entryValue === undefined) {
        return;
      }
      result[key] = stripUndefinedDeep(entryValue);
    });
    return result as T;
  }

  return value;
}

function getPointsBounds(points: number[]): { width: number; height: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    xs.push(points[i]);
    ys.push(points[i + 1]);
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    width: Math.max(LINE_MIN_LENGTH, Math.abs(maxX - minX)),
    height: Math.max(LINE_MIN_LENGTH, Math.abs(maxY - minY)),
  };
}

export function createDefaultObject(
  type: BoardObjectType,
  overrides: Partial<BoardObject> = {},
): BoardObject {
  const createdBy = stringOr(overrides.createdBy, 'guest');
  const nowIso = stringOr(overrides.updatedAt, new Date().toISOString());
  const zIndex = numberOr(overrides.zIndex, 1);
  const base = {
    id: stringOr(overrides.id, crypto.randomUUID()),
    type,
    x: numberOr(overrides.x, 0),
    y: numberOr(overrides.y, 0),
    width: numberOr(overrides.width, 120),
    height: numberOr(overrides.height, 80),
    rotation: numberOr(overrides.rotation, 0),
    color: stringOr(overrides.color, RECT_DEFAULT_COLOR),
    zIndex,
    createdBy,
    updatedAt: nowIso,
  };

  if (type === 'sticky') {
    return {
      ...base,
      type,
      width: Math.max(STICKY_MIN_WIDTH, numberOr(overrides.width, STICKY_DEFAULT_WIDTH)),
      height: Math.max(STICKY_MIN_HEIGHT, numberOr(overrides.height, STICKY_DEFAULT_HEIGHT)),
      color: stringOr(overrides.color, STICKY_DEFAULT_COLOR),
      text: typeof overrides.text === 'string' ? overrides.text : '',
      fontSize: Math.max(10, numberOr(overrides.fontSize, 14)),
    };
  }

  if (type === 'rect') {
    return {
      ...base,
      type,
      width: Math.max(RECT_MIN_SIZE, numberOr(overrides.width, 180)),
      height: Math.max(RECT_MIN_SIZE, numberOr(overrides.height, 120)),
      color: stringOr(overrides.color, RECT_DEFAULT_COLOR),
      stroke: stringOr(overrides.stroke, RECT_DEFAULT_STROKE),
      strokeWidth: Math.max(1, numberOr(overrides.strokeWidth, RECT_DEFAULT_STROKE_WIDTH)),
    };
  }

  if (type === 'circle') {
    const requestedWidth = Math.max(RECT_MIN_SIZE, numberOr(overrides.width, 120));
    const requestedHeight = Math.max(RECT_MIN_SIZE, numberOr(overrides.height, 120));
    const size = Math.max(requestedWidth, requestedHeight);
    return {
      ...base,
      type,
      width: size,
      height: size,
      color: stringOr(overrides.color, CIRCLE_DEFAULT_COLOR),
      stroke: stringOr(overrides.stroke, RECT_DEFAULT_STROKE),
      strokeWidth: Math.max(1, numberOr(overrides.strokeWidth, 2)),
      radius: Math.max(RECT_MIN_SIZE / 2, numberOr(overrides.radius, size / 2)),
    };
  }

  if (type === 'line') {
    const points = parsePoints(overrides.points, [0, 0, 140, 0]);
    const bounds = getPointsBounds(points);
    return {
      ...base,
      type,
      width: Math.max(LINE_MIN_LENGTH, numberOr(overrides.width, bounds.width)),
      height: Math.max(LINE_MIN_LENGTH, numberOr(overrides.height, bounds.height)),
      points,
      color: stringOr(overrides.color, LINE_DEFAULT_COLOR),
      strokeWidth: Math.max(1, numberOr(overrides.strokeWidth, 2)),
    };
  }

  if (type === 'text') {
    return {
      ...base,
      type,
      width: Math.max(TEXT_MIN_WIDTH, numberOr(overrides.width, 180)),
      height: Math.max(TEXT_MIN_HEIGHT, numberOr(overrides.height, 44)),
      text: stringOr(overrides.text, 'Text'),
      color: stringOr(overrides.color, TEXT_DEFAULT_COLOR),
      fontSize: Math.max(10, numberOr(overrides.fontSize, TEXT_DEFAULT_FONT_SIZE)),
    };
  }

  if (type === 'frame') {
    return {
      ...base,
      type,
      width: Math.max(FRAME_MIN_WIDTH, numberOr(overrides.width, 360)),
      height: Math.max(FRAME_MIN_HEIGHT, numberOr(overrides.height, 240)),
      title: stringOr(overrides.title, FRAME_DEFAULT_TITLE),
      color: stringOr(overrides.color, FRAME_DEFAULT_FILL),
      stroke: stringOr(overrides.stroke, FRAME_DEFAULT_STROKE),
      strokeWidth: Math.max(1, numberOr(overrides.strokeWidth, 2)),
    };
  }

  const points = parsePoints(overrides.points, [0, 0, 120, 0]);
  const endpoints = getConnectorEndpoints(points);
  const bounds = getPointsBounds(points);
  const fromId = typeof overrides.fromId === 'string' ? overrides.fromId.trim() : '';
  const toId = typeof overrides.toId === 'string' ? overrides.toId.trim() : '';
  const legacyStyle = parseStyle(overrides.style);
  const strokeStyle = parseConnectorStrokeStyle(
    overrides.strokeStyle,
    legacyStyle === 'dashed' ? 'dashed' : CONNECTOR_DEFAULT_STROKE_STYLE,
  );
  const startArrow = parseConnectorArrowHead(overrides.startArrow, CONNECTOR_DEFAULT_START_ARROW);
  const endArrow = parseConnectorArrowHead(
    overrides.endArrow,
    legacyStyle === 'arrow' ? CONNECTOR_DEFAULT_END_ARROW : CONNECTOR_DEFAULT_START_ARROW,
  );
  const connectorType = parseConnectorPathType(overrides.connectorType);
  const labelPosition = clamp(numberOr(overrides.labelPosition, CONNECTOR_DEFAULT_LABEL_POSITION), 0, 100);
  const fromAttachmentMode = parseConnectorAttachmentMode(
    overrides.fromAttachmentMode,
    fromId ? 'side-center' : 'free',
  );
  const toAttachmentMode = parseConnectorAttachmentMode(overrides.toAttachmentMode, toId ? 'side-center' : 'free');
  return {
    ...base,
    type: 'connector',
    width: Math.max(LINE_MIN_LENGTH, numberOr(overrides.width, bounds.width)),
    height: Math.max(LINE_MIN_LENGTH, numberOr(overrides.height, bounds.height)),
    color: stringOr(overrides.color, CONNECTOR_DEFAULT_COLOR),
    strokeWidth: Math.max(1, numberOr(overrides.strokeWidth, 2)),
    points: parsePoints(overrides.points, [endpoints.startX, endpoints.startY, endpoints.endX, endpoints.endY]),
    fromId,
    toId,
    fromAnchorX: fromId ? parseAnchor(overrides.fromAnchorX) : undefined,
    fromAnchorY: fromId ? parseAnchor(overrides.fromAnchorY) : undefined,
    toAnchorX: toId ? parseAnchor(overrides.toAnchorX) : undefined,
    toAnchorY: toId ? parseAnchor(overrides.toAnchorY) : undefined,
    fromAttachmentMode,
    toAttachmentMode,
    style: legacyStyle,
    strokeStyle,
    connectorType,
    startArrow,
    endArrow,
    label: typeof overrides.label === 'string' ? overrides.label : undefined,
    labelPosition,
    labelBackground: Boolean(
      typeof overrides.labelBackground === 'boolean'
        ? overrides.labelBackground
        : CONNECTOR_DEFAULT_LABEL_BACKGROUND,
    ),
    pathControlX: Number.isFinite(Number(overrides.pathControlX))
      ? Number(overrides.pathControlX)
      : undefined,
    pathControlY: Number.isFinite(Number(overrides.pathControlY))
      ? Number(overrides.pathControlY)
      : undefined,
    curveOffset: Number.isFinite(Number(overrides.curveOffset))
      ? Number(overrides.curveOffset)
      : undefined,
  };
}

export function clampObjectDimensions(
  partial: Partial<BoardObject> & { id: string; type: BoardObjectType; x: number; y: number },
  factory: DefaultBoardObjectFactory,
): BoardObject {
  return createDefaultObject(partial.type, {
    ...partial,
    id: partial.id,
    createdBy: factory.createdBy,
    updatedAt: factory.nowIso,
    zIndex: numberOr(partial.zIndex, factory.nextZIndex),
  });
}

export function normalizeLoadedObject(raw: unknown, fallbackUserId: string): BoardObject | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const candidate = raw as Partial<BoardObject>;
  if (!isBoardObjectType(candidate.type)) {
    return null;
  }

  return createDefaultObject(candidate.type, {
    ...candidate,
    id: stringOr(candidate.id, crypto.randomUUID()),
    createdBy: stringOr(candidate.createdBy, fallbackUserId),
    updatedAt: stringOr(candidate.updatedAt, new Date().toISOString()),
    zIndex: numberOr(candidate.zIndex, 1),
  });
}

export function sanitizeBoardObjectForFirestore(entry: BoardObject): BoardObject {
  const normalized = createDefaultObject(entry.type, entry);

  if (normalized.type === 'sticky') {
    return stripUndefinedDeep({
      id: normalized.id,
      type: normalized.type,
      x: normalized.x,
      y: normalized.y,
      width: normalized.width,
      height: normalized.height,
      rotation: normalized.rotation,
      text: normalized.text || '',
      color: normalized.color,
      fontSize: normalized.fontSize || 14,
      zIndex: normalized.zIndex,
      createdBy: normalized.createdBy,
      updatedAt: normalized.updatedAt,
    });
  }

  if (normalized.type === 'rect' || normalized.type === 'circle') {
    return stripUndefinedDeep({
      id: normalized.id,
      type: normalized.type,
      x: normalized.x,
      y: normalized.y,
      width: normalized.width,
      height: normalized.height,
      rotation: normalized.rotation,
      color: normalized.color,
      stroke: normalized.stroke,
      strokeWidth: normalized.strokeWidth,
      radius: normalized.type === 'circle' ? normalized.radius : undefined,
      zIndex: normalized.zIndex,
      createdBy: normalized.createdBy,
      updatedAt: normalized.updatedAt,
    });
  }

  if (normalized.type === 'text') {
    return stripUndefinedDeep({
      id: normalized.id,
      type: normalized.type,
      x: normalized.x,
      y: normalized.y,
      width: normalized.width,
      height: normalized.height,
      rotation: normalized.rotation,
      text: normalized.text || '',
      color: normalized.color,
      fontSize: normalized.fontSize || TEXT_DEFAULT_FONT_SIZE,
      zIndex: normalized.zIndex,
      createdBy: normalized.createdBy,
      updatedAt: normalized.updatedAt,
    });
  }

  if (normalized.type === 'frame') {
    return stripUndefinedDeep({
      id: normalized.id,
      type: normalized.type,
      x: normalized.x,
      y: normalized.y,
      width: normalized.width,
      height: normalized.height,
      rotation: normalized.rotation,
      title: normalized.title || FRAME_DEFAULT_TITLE,
      color: normalized.color,
      stroke: normalized.stroke || FRAME_DEFAULT_STROKE,
      strokeWidth: normalized.strokeWidth || 2,
      zIndex: normalized.zIndex,
      createdBy: normalized.createdBy,
      updatedAt: normalized.updatedAt,
    });
  }

  if (normalized.type === 'line') {
    return stripUndefinedDeep({
      id: normalized.id,
      type: normalized.type,
      x: normalized.x,
      y: normalized.y,
      width: normalized.width,
      height: normalized.height,
      rotation: normalized.rotation,
      points: normalized.points,
      color: normalized.color,
      strokeWidth: normalized.strokeWidth || 2,
      zIndex: normalized.zIndex,
      createdBy: normalized.createdBy,
      updatedAt: normalized.updatedAt,
    });
  }

  return stripUndefinedDeep({
    id: normalized.id,
    type: normalized.type,
    x: normalized.x,
    y: normalized.y,
    width: normalized.width,
    height: normalized.height,
    rotation: normalized.rotation,
    points: normalized.points,
    fromId: normalized.fromId,
    toId: normalized.toId,
    fromAnchorX: normalized.fromAnchorX,
    fromAnchorY: normalized.fromAnchorY,
    toAnchorX: normalized.toAnchorX,
    toAnchorY: normalized.toAnchorY,
    fromAttachmentMode: normalized.fromAttachmentMode,
    toAttachmentMode: normalized.toAttachmentMode,
    style: normalized.style || CONNECTOR_DEFAULT_STYLE,
    strokeStyle: normalized.strokeStyle || CONNECTOR_DEFAULT_STROKE_STYLE,
    connectorType: normalized.connectorType || CONNECTOR_DEFAULT_PATH_TYPE,
    startArrow: normalized.startArrow || CONNECTOR_DEFAULT_START_ARROW,
    endArrow: normalized.endArrow || CONNECTOR_DEFAULT_END_ARROW,
    label: normalized.label || undefined,
    labelPosition: clamp(numberOr(normalized.labelPosition, CONNECTOR_DEFAULT_LABEL_POSITION), 0, 100),
    labelBackground:
      typeof normalized.labelBackground === 'boolean'
        ? normalized.labelBackground
        : CONNECTOR_DEFAULT_LABEL_BACKGROUND,
    pathControlX: Number.isFinite(Number(normalized.pathControlX))
      ? Number(normalized.pathControlX)
      : undefined,
    pathControlY: Number.isFinite(Number(normalized.pathControlY))
      ? Number(normalized.pathControlY)
      : undefined,
    curveOffset: Number.isFinite(Number(normalized.curveOffset))
      ? Number(normalized.curveOffset)
      : undefined,
    color: normalized.color,
    strokeWidth: normalized.strokeWidth || 2,
    zIndex: normalized.zIndex,
    createdBy: normalized.createdBy,
    updatedAt: normalized.updatedAt,
  });
}

function parseUpdatedAtMs(value: string | undefined): number {
  const ms = Date.parse(String(value || ''));
  return Number.isFinite(ms) ? ms : 0;
}

export function applyIncomingObjectUpsert({
  existing,
  incoming,
  eventTs,
}: ApplyIncomingObjectInput): ApplyIncomingObjectResult {
  if (!existing) {
    return { shouldApply: true };
  }

  const localUpdatedAtMs = parseUpdatedAtMs(existing.updatedAt);
  const incomingUpdatedAtMs = parseUpdatedAtMs(incoming.updatedAt);

  if (incomingUpdatedAtMs && localUpdatedAtMs && incomingUpdatedAtMs <= localUpdatedAtMs) {
    return { shouldApply: false };
  }

  if (Number.isFinite(eventTs) && localUpdatedAtMs && Number(eventTs) < localUpdatedAtMs) {
    return { shouldApply: false };
  }

  return { shouldApply: true };
}

export function getObjectBounds(entry: BoardObject): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (entry.type === 'line' || entry.type === 'connector') {
    const points = parsePoints(entry.points, [0, 0, entry.width, entry.height]);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < points.length; i += 2) {
      xs.push(points[i]);
      ys.push(points[i + 1]);
    }
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      x: entry.x + minX,
      y: entry.y + minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  }

  return {
    x: entry.x,
    y: entry.y,
    width: Math.max(1, entry.width),
    height: Math.max(1, entry.height),
  };
}

export function getObjectCenter(entry: BoardObject): { x: number; y: number } {
  const bounds = getObjectBounds(entry);
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

export function resolveObjectAnchorPoint(
  entry: BoardObject,
  anchorX?: number,
  anchorY?: number,
): { x: number; y: number } {
  if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) {
    return getObjectCenter(entry);
  }

  const bounds = getObjectBounds(entry);
  const safeWidth = Math.max(1, bounds.width);
  const safeHeight = Math.max(1, bounds.height);
  return {
    x: bounds.x + clamp01(Number(anchorX)) * safeWidth,
    y: bounds.y + clamp01(Number(anchorY)) * safeHeight,
  };
}

export function getObjectAnchorCandidates(entry: BoardObject): ObjectAnchorPoint[] {
  if (entry.type === 'line' || entry.type === 'connector') {
    return [];
  }

  const bounds = getObjectBounds(entry);
  const safeWidth = Math.max(1, bounds.width);
  const safeHeight = Math.max(1, bounds.height);
  const anchors =
    entry.type === 'circle'
      ? [
          { anchorX: 0.5, anchorY: 0 },
          { anchorX: 0.8536, anchorY: 0.1464 },
          { anchorX: 1, anchorY: 0.5 },
          { anchorX: 0.8536, anchorY: 0.8536 },
          { anchorX: 0.5, anchorY: 1 },
          { anchorX: 0.1464, anchorY: 0.8536 },
          { anchorX: 0, anchorY: 0.5 },
          { anchorX: 0.1464, anchorY: 0.1464 },
        ]
      : [
          { anchorX: 0, anchorY: 0 },
          { anchorX: 0.5, anchorY: 0 },
          { anchorX: 1, anchorY: 0 },
          { anchorX: 1, anchorY: 0.5 },
          { anchorX: 1, anchorY: 1 },
          { anchorX: 0.5, anchorY: 1 },
          { anchorX: 0, anchorY: 1 },
          { anchorX: 0, anchorY: 0.5 },
        ];

  return anchors.map((anchor) => ({
    anchorX: anchor.anchorX,
    anchorY: anchor.anchorY,
    x: bounds.x + anchor.anchorX * safeWidth,
    y: bounds.y + anchor.anchorY * safeHeight,
  }));
}

export function getObjectSideAnchorCandidates(entry: BoardObject): ObjectAnchorPoint[] {
  if (entry.type === 'line' || entry.type === 'connector') {
    return [];
  }

  const bounds = getObjectBounds(entry);
  const safeWidth = Math.max(1, bounds.width);
  const safeHeight = Math.max(1, bounds.height);
  const anchors = [
    { anchorX: 0.5, anchorY: 0 },
    { anchorX: 1, anchorY: 0.5 },
    { anchorX: 0.5, anchorY: 1 },
    { anchorX: 0, anchorY: 0.5 },
  ];

  return anchors.map((anchor) => ({
    anchorX: anchor.anchorX,
    anchorY: anchor.anchorY,
    x: bounds.x + anchor.anchorX * safeWidth,
    y: bounds.y + anchor.anchorY * safeHeight,
  }));
}

export function projectPointToObjectPerimeter(
  entry: BoardObject,
  point: { x: number; y: number },
): { x: number; y: number; anchorX: number; anchorY: number } {
  const bounds = getObjectBounds(entry);
  const safeWidth = Math.max(1, bounds.width);
  const safeHeight = Math.max(1, bounds.height);
  const center = getObjectCenter(entry);

  if (entry.type === 'circle') {
    const radiusX = safeWidth / 2;
    const radiusY = safeHeight / 2;
    let dx = point.x - center.x;
    let dy = point.y - center.y;
    if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) {
      dx = 1;
      dy = 0;
    }

    const denominator = Math.sqrt((dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY)) || 1;
    const x = center.x + dx / denominator;
    const y = center.y + dy / denominator;
    return {
      x,
      y,
      anchorX: clamp01((x - bounds.x) / safeWidth),
      anchorY: clamp01((y - bounds.y) / safeHeight),
    };
  }

  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const normalizedX = dx / safeWidth;
  const normalizedY = dy / safeHeight;

  if (Math.abs(normalizedX) >= Math.abs(normalizedY)) {
    const x = dx >= 0 ? bounds.x + safeWidth : bounds.x;
    const y = clamp(point.y, bounds.y, bounds.y + safeHeight);
    return {
      x,
      y,
      anchorX: clamp01((x - bounds.x) / safeWidth),
      anchorY: clamp01((y - bounds.y) / safeHeight),
    };
  }

  const y = dy >= 0 ? bounds.y + safeHeight : bounds.y;
  const x = clamp(point.x, bounds.x, bounds.x + safeWidth);
  return {
    x,
    y,
    anchorX: clamp01((x - bounds.x) / safeWidth),
    anchorY: clamp01((y - bounds.y) / safeHeight),
  };
}

export function resolveConnectorPoints({
  from,
  to,
  fromAnchorX,
  fromAnchorY,
  toAnchorX,
  toAnchorY,
  connectorType = CONNECTOR_DEFAULT_PATH_TYPE,
  pathControlX,
  pathControlY,
  curveOffset,
  obstacles = [],
  clearance,
  turnPenalty,
  fallback,
}: {
  from: BoardObject | undefined;
  to: BoardObject | undefined;
  fromAnchorX?: number;
  fromAnchorY?: number;
  toAnchorX?: number;
  toAnchorY?: number;
  connectorType?: ConnectorPathType;
  pathControlX?: number;
  pathControlY?: number;
  curveOffset?: number;
  obstacles?: ConnectorObstacle[];
  clearance?: number;
  turnPenalty?: number;
  fallback: number[];
}): number[] {
  const normalizedFallback = parsePoints(fallback, [0, 0, 120, 0]);
  const fallbackEndpoints = getConnectorEndpoints(normalizedFallback);
  const start = from
    ? resolveObjectAnchorPoint(from, fromAnchorX, fromAnchorY)
    : {
        x: fallbackEndpoints.startX,
        y: fallbackEndpoints.startY,
      };
  const end = to
    ? resolveObjectAnchorPoint(to, toAnchorX, toAnchorY)
    : {
        x: fallbackEndpoints.endX,
        y: fallbackEndpoints.endY,
      };

  return buildConnectorRenderPoints({
    type: (connectorType || CONNECTOR_DEFAULT_PATH_TYPE) as RouteConnectorPathType,
    start,
    end,
    obstacles,
    clearance,
    turnPenalty,
    curveOffset,
    controlPoint:
      Number.isFinite(pathControlX) && Number.isFinite(pathControlY)
        ? {
            x: Number(pathControlX),
            y: Number(pathControlY),
          }
        : undefined,
  });
}
