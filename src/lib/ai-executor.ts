import {
  createDefaultObject,
  resolveConnectorPoints,
  sanitizeBoardObjectForFirestore,
} from './board-object';
import type { BoardObject, BoardObjectsRecord } from '../types/board';
import type {
  AIActionPlan,
  AIActionPreview,
  AIExecutionDiff,
  AIExecutionResult,
  ExecutableAIAction,
  ToolCallToActionContext,
  ToolCallToActionDependencies,
} from '../types/ai';

interface BuildAIActionPlanInput {
  previews: AIActionPreview[];
  context: ToolCallToActionContext;
  message?: string | null;
}

interface ExecuteAIActionPlanInput {
  plan: AIActionPlan;
  currentObjects: BoardObjectsRecord;
  actorUserId: string;
}

interface AIExecutorDependencies extends ToolCallToActionDependencies {
  nowIso?: () => string;
}

function fallbackCreateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ai-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneObject(entry: BoardObject): BoardObject {
  return {
    ...entry,
    points: Array.isArray(entry.points) ? [...entry.points] : entry.points,
  };
}

function cloneRecord(record: BoardObjectsRecord): BoardObjectsRecord {
  const next: BoardObjectsRecord = {};
  Object.entries(record).forEach(([id, entry]) => {
    next[id] = cloneObject(entry);
  });
  return next;
}

function getMaxZIndex(record: BoardObjectsRecord): number {
  return Object.values(record).reduce((max, entry) => Math.max(max, entry.zIndex), 0);
}

function numberFromInput(
  input: Record<string, unknown>,
  key: string,
  fallback?: number,
): number {
  const value = Number(input[key]);
  if (Number.isFinite(value)) {
    return value;
  }
  if (Number.isFinite(fallback)) {
    return Number(fallback);
  }
  throw new Error(`Missing numeric field: ${key}`);
}

function stringFromInput(
  input: Record<string, unknown>,
  key: string,
  fallback?: string,
): string {
  const value = input[key];
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof fallback === 'string' && fallback.trim()) {
    return fallback.trim();
  }
  throw new Error(`Missing string field: ${key}`);
}

function optionalStringFromInput(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return undefined;
}

function optionalNumberFromInput(input: Record<string, unknown>, key: string): number | undefined {
  const value = Number(input[key]);
  return Number.isFinite(value) ? value : undefined;
}

function toRecordInput(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function ensureConnectorPoints(object: BoardObject, record: BoardObjectsRecord): BoardObject {
  if (object.type !== 'connector') {
    return object;
  }

  const from = object.fromId ? record[object.fromId] : undefined;
  const to = object.toId ? record[object.toId] : undefined;
  const fallback = object.points || [object.x, object.y, object.x + object.width, object.y];
  const points = resolveConnectorPoints({
    from,
    to,
    fromAnchorX: object.fromAnchorX,
    fromAnchorY: object.fromAnchorY,
    toAnchorX: object.toAnchorX,
    toAnchorY: object.toAnchorY,
    fallback,
  });

  return createDefaultObject('connector', {
    ...object,
    x: 0,
    y: 0,
    points,
    width: Math.max(1, Math.abs((points[2] || 0) - (points[0] || 0))),
    height: Math.max(1, Math.abs((points[3] || 0) - (points[1] || 0))),
  });
}

function syncAllConnectorPoints(record: BoardObjectsRecord) {
  Object.values(record).forEach((entry) => {
    if (entry.type !== 'connector') {
      return;
    }
    record[entry.id] = ensureConnectorPoints(entry, record);
  });
}

function getDiff(previous: BoardObjectsRecord, next: BoardObjectsRecord): AIExecutionDiff {
  const createdIds: string[] = [];
  const updatedIds: string[] = [];
  const deletedIds: string[] = [];

  const previousIds = new Set(Object.keys(previous));
  const nextIds = new Set(Object.keys(next));

  nextIds.forEach((id) => {
    if (!previousIds.has(id)) {
      createdIds.push(id);
      return;
    }

    const previousValue = sanitizeBoardObjectForFirestore(previous[id]);
    const nextValue = sanitizeBoardObjectForFirestore(next[id]);
    if (JSON.stringify(previousValue) !== JSON.stringify(nextValue)) {
      updatedIds.push(id);
    }
  });

  previousIds.forEach((id) => {
    if (!nextIds.has(id)) {
      deletedIds.push(id);
    }
  });

  return { createdIds, updatedIds, deletedIds };
}

function normalizePatchForLineLike(
  existing: BoardObject,
  patch: Partial<BoardObject>,
): Partial<BoardObject> {
  if (
    existing.type !== 'line' &&
    existing.type !== 'connector'
  ) {
    return patch;
  }

  if (Array.isArray(patch.points)) {
    return patch;
  }

  const nextWidth = optionalNumberFromInput(patch as Record<string, unknown>, 'width');
  const nextHeight = optionalNumberFromInput(patch as Record<string, unknown>, 'height');
  if (!Number.isFinite(nextWidth) && !Number.isFinite(nextHeight)) {
    return patch;
  }

  const existingPoints =
    Array.isArray(existing.points) && existing.points.length >= 4
      ? existing.points
      : [0, 0, existing.width, existing.height];

  const startX = existingPoints[0] || 0;
  const startY = existingPoints[1] || 0;
  const currentWidth = (existingPoints[2] || 0) - (existingPoints[0] || 0);
  const currentHeight = (existingPoints[3] || 0) - (existingPoints[1] || 0);

  return {
    ...patch,
    points: [
      startX,
      startY,
      startX + (Number.isFinite(nextWidth) ? Number(nextWidth) : currentWidth),
      startY + (Number.isFinite(nextHeight) ? Number(nextHeight) : currentHeight),
    ],
  };
}

function validateUpdatePatch(existing: BoardObject, patch: Partial<BoardObject>): string | null {
  if (typeof patch.text === 'string') {
    if (existing.type !== 'sticky' && existing.type !== 'text' && existing.type !== 'frame') {
      return `Text updates are not supported for ${existing.type} objects.`;
    }
  }

  if (typeof patch.title === 'string' && existing.type !== 'frame') {
    return `Title updates are only supported for frame objects.`;
  }

  if (Array.isArray(patch.points) && existing.type !== 'line' && existing.type !== 'connector') {
    return `Point updates are only supported for line and connector objects.`;
  }

  return null;
}

function actionFromPreview(
  preview: AIActionPreview,
  context: ToolCallToActionContext & {
    nextZIndex: number;
    nowIso: string;
    createId: () => string;
    working: BoardObjectsRecord;
  },
): ExecutableAIAction | null {
  const input = toRecordInput(preview.input);
  const name = preview.name.trim();

  if (name === 'getBoardState') {
    return null;
  }

  if (name === 'createStickyNote') {
    const id = optionalStringFromInput(input, 'objectId') || optionalStringFromInput(input, 'id') || context.createId();
    const object = createDefaultObject('sticky', {
      id,
      x: numberFromInput(input, 'x'),
      y: numberFromInput(input, 'y'),
      text: optionalStringFromInput(input, 'text') || '',
      color: optionalStringFromInput(input, 'color'),
      width: optionalNumberFromInput(input, 'width'),
      height: optionalNumberFromInput(input, 'height'),
      zIndex: context.nextZIndex,
      createdBy: context.actorUserId,
      updatedAt: context.nowIso,
    });
    return { kind: 'create', object };
  }

  if (name === 'createShape') {
    const shapeType = optionalStringFromInput(input, 'type');
    if (shapeType !== 'rect' && shapeType !== 'circle' && shapeType !== 'line') {
      throw new Error('createShape requires type rect, circle, or line');
    }

    const id = optionalStringFromInput(input, 'objectId') || optionalStringFromInput(input, 'id') || context.createId();
    const x = numberFromInput(input, 'x');
    const y = numberFromInput(input, 'y');
    let width = optionalNumberFromInput(input, 'width');
    let height = optionalNumberFromInput(input, 'height');

    if (shapeType === 'line') {
      const x2 =
        optionalNumberFromInput(input, 'x2') ??
        optionalNumberFromInput(input, 'toX') ??
        optionalNumberFromInput(input, 'endX');
      const y2 =
        optionalNumberFromInput(input, 'y2') ??
        optionalNumberFromInput(input, 'toY') ??
        optionalNumberFromInput(input, 'endY');

      if (!Number.isFinite(width) && Number.isFinite(x2)) {
        width = Number(x2) - x;
      }
      if (!Number.isFinite(height) && Number.isFinite(y2)) {
        height = Number(y2) - y;
      }
    }

    const object = createDefaultObject(shapeType, {
      id,
      x,
      y,
      width,
      height,
      points:
        shapeType === 'line' && (Number.isFinite(width) || Number.isFinite(height))
          ? [0, 0, Number.isFinite(width) ? Number(width) : 140, Number.isFinite(height) ? Number(height) : 0]
          : undefined,
      color: optionalStringFromInput(input, 'color'),
      zIndex: context.nextZIndex,
      createdBy: context.actorUserId,
      updatedAt: context.nowIso,
    });
    return { kind: 'create', object };
  }

  if (name === 'createFrame') {
    const id = optionalStringFromInput(input, 'objectId') || optionalStringFromInput(input, 'id') || context.createId();
    const object = createDefaultObject('frame', {
      id,
      title: optionalStringFromInput(input, 'title') || 'Frame',
      x: numberFromInput(input, 'x'),
      y: numberFromInput(input, 'y'),
      width: optionalNumberFromInput(input, 'width'),
      height: optionalNumberFromInput(input, 'height'),
      zIndex: context.nextZIndex,
      createdBy: context.actorUserId,
      updatedAt: context.nowIso,
    });
    return { kind: 'create', object };
  }

  if (name === 'createConnector') {
    const id = optionalStringFromInput(input, 'objectId') || optionalStringFromInput(input, 'id') || context.createId();
    const fromId = stringFromInput(input, 'fromId');
    const toId = stringFromInput(input, 'toId');
    const style = optionalStringFromInput(input, 'style');
    const connectorTypeInput = optionalStringFromInput(input, 'connectorType') || optionalStringFromInput(input, 'type');
    const connectorType =
      connectorTypeInput === 'straight' || connectorTypeInput === 'bent' || connectorTypeInput === 'curved'
        ? connectorTypeInput
        : undefined;
    const strokeStyleInput = optionalStringFromInput(input, 'strokeStyle');
    const strokeStyle = strokeStyleInput === 'solid' || strokeStyleInput === 'dashed' ? strokeStyleInput : undefined;
    const startArrowInput = optionalStringFromInput(input, 'startArrow');
    const startArrow =
      startArrowInput === 'none' ||
      startArrowInput === 'solid' ||
      startArrowInput === 'line' ||
      startArrowInput === 'triangle' ||
      startArrowInput === 'diamond'
        ? startArrowInput
        : undefined;
    const endArrowInput = optionalStringFromInput(input, 'endArrow');
    const endArrow =
      endArrowInput === 'none' ||
      endArrowInput === 'solid' ||
      endArrowInput === 'line' ||
      endArrowInput === 'triangle' ||
      endArrowInput === 'diamond'
        ? endArrowInput
        : undefined;

    const fallbackObject = createDefaultObject('connector', {
      id,
      fromId,
      toId,
      style: style === 'line' || style === 'dashed' || style === 'arrow' ? style : 'arrow',
      strokeStyle,
      connectorType,
      startArrow,
      endArrow,
      label: optionalStringFromInput(input, 'label'),
      labelPosition: optionalNumberFromInput(input, 'labelPosition'),
      zIndex: context.nextZIndex,
      createdBy: context.actorUserId,
      updatedAt: context.nowIso,
    });

    return {
      kind: 'create',
      object: ensureConnectorPoints(fallbackObject, context.working),
    };
  }

  if (name === 'moveObject') {
    return {
      kind: 'update',
      objectId: stringFromInput(input, 'objectId'),
      patch: {
        x: numberFromInput(input, 'x'),
        y: numberFromInput(input, 'y'),
      },
    };
  }

  if (name === 'resizeObject') {
    return {
      kind: 'update',
      objectId: stringFromInput(input, 'objectId'),
      patch: {
        width: numberFromInput(input, 'width'),
        height: numberFromInput(input, 'height'),
      },
    };
  }

  if (name === 'updateText') {
    return {
      kind: 'update',
      objectId: stringFromInput(input, 'objectId'),
      patch: {
        text: stringFromInput(input, 'newText'),
      },
    };
  }

  if (name === 'changeColor') {
    return {
      kind: 'update',
      objectId: stringFromInput(input, 'objectId'),
      patch: {
        color: stringFromInput(input, 'color'),
      },
    };
  }

  if (name === 'deleteObject' || name === 'removeObject') {
    return {
      kind: 'delete',
      objectId: stringFromInput(input, 'objectId'),
    };
  }

  throw new Error(`Unsupported tool call: ${name}`);
}

export function buildAIActionPlanFromPreviews(
  { previews, context, message = null }: BuildAIActionPlanInput,
  dependencies: ToolCallToActionDependencies = {},
): AIActionPlan {
  const createId = dependencies.createId || fallbackCreateId;
  const nowMs = dependencies.nowMs ? dependencies.nowMs() : Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const working = cloneRecord(context.currentObjects);
  let nextZIndex = getMaxZIndex(working) + 1;
  const actions: ExecutableAIAction[] = [];

  previews.forEach((preview) => {
    const action = actionFromPreview(preview, {
      ...context,
      nextZIndex,
      nowIso,
      createId,
      working,
    });
    if (!action) {
      return;
    }
    actions.push(action);
    if (action.kind === 'create') {
      working[action.object.id] = cloneObject(action.object);
      nextZIndex += 1;
    } else if (action.kind === 'delete') {
      delete working[action.objectId];
    } else if (action.kind === 'update') {
      const existing = working[action.objectId];
      if (existing) {
        const patch = normalizePatchForLineLike(existing, action.patch);
        const next = createDefaultObject(existing.type, {
          ...existing,
          ...patch,
          id: existing.id,
          createdBy: existing.createdBy,
          updatedAt: nowIso,
        });
        working[next.id] = ensureConnectorPoints(next, working);
      }
    }
    syncAllConnectorPoints(working);
  });

  return {
    planId: createId(),
    actions,
    message,
  };
}

export function executeAIActionPlan(
  { plan, currentObjects, actorUserId }: ExecuteAIActionPlanInput,
  dependencies: AIExecutorDependencies = {},
): AIExecutionResult {
  const createId = dependencies.createId || fallbackCreateId;
  const nowMsValue = dependencies.nowMs ? dependencies.nowMs() : Date.now();
  const nowIsoValue = dependencies.nowIso ? dependencies.nowIso() : new Date(nowMsValue).toISOString();
  const working = cloneRecord(currentObjects);
  const inverseActions: ExecutableAIAction[] = [];

  for (let i = 0; i < plan.actions.length; i += 1) {
    const action = plan.actions[i];
    try {
      if (action.kind === 'create') {
        if (working[action.object.id]) {
          throw new Error(`Object already exists: ${action.object.id}`);
        }

        const created = createDefaultObject(action.object.type, {
          ...action.object,
          id: action.object.id,
          createdBy: action.object.createdBy || actorUserId,
          updatedAt: nowIsoValue,
        });
        working[created.id] = ensureConnectorPoints(created, working);
        inverseActions.unshift({ kind: 'delete', objectId: created.id });
      } else if (action.kind === 'update') {
        const existing = working[action.objectId];
        if (!existing) {
          throw new Error(`Object not found: ${action.objectId}`);
        }

        const patchError = validateUpdatePatch(existing, action.patch);
        if (patchError) {
          throw new Error(patchError);
        }

        const normalizedPatch = normalizePatchForLineLike(existing, action.patch);
        const nextType = existing.type;
        const patchWithoutType = {
          ...normalizedPatch,
          type: undefined,
          id: undefined,
        };
        const updated = createDefaultObject(nextType, {
          ...existing,
          ...patchWithoutType,
          id: existing.id,
          createdBy: existing.createdBy,
          updatedAt: nowIsoValue,
          text:
            nextType === 'frame' && typeof normalizedPatch.text === 'string'
              ? existing.text
              : normalizedPatch.text ?? existing.text,
          title:
            nextType === 'frame' && typeof normalizedPatch.text === 'string'
              ? normalizedPatch.text
              : normalizedPatch.title ?? existing.title,
        });

        working[updated.id] = ensureConnectorPoints(updated, working);
        inverseActions.unshift({
          kind: 'update',
          objectId: existing.id,
          patch: cloneObject(existing),
        });
      } else {
        const existing = working[action.objectId];
        if (!existing) {
          throw new Error(`Object not found: ${action.objectId}`);
        }

        delete working[action.objectId];
        inverseActions.unshift({
          kind: 'create',
          object: cloneObject(existing),
        });
      }

      syncAllConnectorPoints(working);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'AI action execution failed.',
        failedActionIndex: i,
      };
    }
  }

  const diff = getDiff(currentObjects, working);
  return {
    ok: true,
    nextObjects: working,
    diff,
    transaction: {
      txId: createId(),
      actions: plan.actions.map((action) =>
        action.kind === 'create'
          ? { kind: 'create', object: cloneObject(action.object) }
          : action.kind === 'update'
            ? { kind: 'update', objectId: action.objectId, patch: { ...action.patch } }
            : { kind: 'delete', objectId: action.objectId },
      ),
      inverseActions,
      createdAt: nowMsValue,
      actorUserId,
    },
  };
}
