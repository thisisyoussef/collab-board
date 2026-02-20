import type { BoardObject, BoardObjectType } from '../types/board';

export type BoardLogSource = 'local' | 'ai' | 'remote';

export type BoardActionKind =
  | 'create'
  | 'delete'
  | 'copy'
  | 'paste'
  | 'duplicate'
  | 'update';

export interface BoardActionLogEntry {
  message: string;
  context: Record<string, unknown>;
}

export interface BoardObjectDeltaDescription {
  changes: Array<'move' | 'resize' | 'rotate' | 'update'>;
  fields: string[];
  message: string;
  before: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
  after: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
}

export interface BuildActionLogEntryInput {
  source: BoardLogSource;
  action: BoardActionKind;
  object?: BoardObject;
  before?: BoardObject;
  after?: BoardObject;
  sourceObjectId?: string;
  actorUserId?: string;
}

const NON_GEOMETRY_IGNORED_FIELDS = new Set([
  'id',
  'type',
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'zIndex',
  'createdBy',
  'updatedAt',
]);

function round(value: number): number {
  return Math.round(Number(value) || 0);
}

function valueChanged(beforeValue: unknown, afterValue: unknown): boolean {
  return JSON.stringify(beforeValue) !== JSON.stringify(afterValue);
}

function objectPose(object: BoardObject) {
  return {
    x: round(object.x),
    y: round(object.y),
    width: round(object.width),
    height: round(object.height),
    rotation: round(object.rotation),
  };
}

function getChangedNonGeometryFields(before: BoardObject, after: BoardObject): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const fields: string[] = [];

  keys.forEach((key) => {
    if (NON_GEOMETRY_IGNORED_FIELDS.has(key)) {
      return;
    }

    const beforeValue = (before as unknown as Record<string, unknown>)[key];
    const afterValue = (after as unknown as Record<string, unknown>)[key];
    if (valueChanged(beforeValue, afterValue)) {
      fields.push(key);
    }
  });

  return fields.sort();
}

function joinFields(fields: string[]): string {
  if (fields.length === 0) {
    return '';
  }
  if (fields.length <= 4) {
    return fields.join(', ');
  }

  return `${fields.slice(0, 4).join(', ')}, +${fields.length - 4} more`;
}

export function formatObjectLabel(type: BoardObjectType): string {
  switch (type) {
    case 'sticky':
      return 'Sticky note';
    case 'rect':
      return 'Rectangle';
    case 'circle':
      return 'Circle';
    case 'line':
      return 'Line';
    case 'text':
      return 'Text';
    case 'frame':
      return 'Frame';
    case 'connector':
      return 'Connector';
    default:
      return 'Object';
  }
}

export function describeBoardObjectDelta(
  before: BoardObject | undefined,
  after: BoardObject | undefined,
): BoardObjectDeltaDescription | null {
  if (!before || !after) {
    return null;
  }

  const label = formatObjectLabel(after.type);
  const beforePose = objectPose(before);
  const afterPose = objectPose(after);

  const changes: Array<'move' | 'resize' | 'rotate' | 'update'> = [];
  const parts: string[] = [];

  if (beforePose.x !== afterPose.x || beforePose.y !== afterPose.y) {
    changes.push('move');
    parts.push(
      `Moved ${label} '${after.id}' from (${beforePose.x}, ${beforePose.y}) to (${afterPose.x}, ${afterPose.y}).`,
    );
  }

  if (beforePose.width !== afterPose.width || beforePose.height !== afterPose.height) {
    changes.push('resize');
    parts.push(
      `Resized ${label} '${after.id}' from ${beforePose.width}x${beforePose.height} to ${afterPose.width}x${afterPose.height}.`,
    );
  }

  if (beforePose.rotation !== afterPose.rotation) {
    changes.push('rotate');
    parts.push(
      `Rotated ${label} '${after.id}' from ${beforePose.rotation}\u00b0 to ${afterPose.rotation}\u00b0.`,
    );
  }

  const fields = getChangedNonGeometryFields(before, after);

  if (changes.length === 0 && fields.length > 0) {
    changes.push('update');
    parts.push(
      `Updated ${label} '${after.id}' fields: ${joinFields(fields)}.`,
    );
  }

  if (changes.length === 0) {
    return null;
  }

  return {
    changes,
    fields,
    message: parts.join(' '),
    before: beforePose,
    after: afterPose,
  };
}

function buildCreateLog(
  source: BoardLogSource,
  action: Extract<BoardActionKind, 'create' | 'paste' | 'duplicate'>,
  object: BoardObject,
  sourceObjectId?: string,
  actorUserId?: string,
): BoardActionLogEntry {
  const label = formatObjectLabel(object.type);
  const pose = objectPose(object);

  const verb =
    action === 'create'
      ? 'Created'
      : action === 'paste'
        ? 'Pasted'
        : 'Duplicated';

  const suffix = sourceObjectId ? ` from '${sourceObjectId}'.` : '.';
  const relation =
    action === 'create'
      ? ` at (${pose.x}, ${pose.y}).`
      : ` at (${pose.x}, ${pose.y})${suffix}`;

  return {
    message: `${verb} ${label} '${object.id}'${relation}`,
    context: {
      source,
      action,
      objectId: object.id,
      objectType: object.type,
      ...(actorUserId ? { actorUserId } : {}),
      ...(sourceObjectId ? { sourceObjectId } : {}),
      after: pose,
      changes: [action],
    },
  };
}

function buildDeleteLog(
  source: BoardLogSource,
  before: BoardObject,
  actorUserId?: string,
): BoardActionLogEntry {
  const label = formatObjectLabel(before.type);
  const pose = objectPose(before);

  return {
    message: `Deleted ${label} '${before.id}' at (${pose.x}, ${pose.y}).`,
    context: {
      source,
      action: 'delete',
      objectId: before.id,
      objectType: before.type,
      ...(actorUserId ? { actorUserId } : {}),
      before: pose,
      changes: ['delete'],
    },
  };
}

function buildCopyLog(
  source: BoardLogSource,
  object: BoardObject,
  actorUserId?: string,
): BoardActionLogEntry {
  const label = formatObjectLabel(object.type);
  const pose = objectPose(object);

  return {
    message: `Copied ${label} '${object.id}' from (${pose.x}, ${pose.y}).`,
    context: {
      source,
      action: 'copy',
      objectId: object.id,
      objectType: object.type,
      ...(actorUserId ? { actorUserId } : {}),
      before: pose,
      changes: ['copy'],
    },
  };
}

function buildUpdateLog(
  source: BoardLogSource,
  before: BoardObject,
  after: BoardObject,
  actorUserId?: string,
): BoardActionLogEntry | null {
  const delta = describeBoardObjectDelta(before, after);
  if (!delta) {
    return null;
  }

  return {
    message: delta.message,
    context: {
      source,
      action: 'update',
      objectId: after.id,
      objectType: after.type,
      ...(actorUserId ? { actorUserId } : {}),
      before: delta.before,
      after: delta.after,
      changes: delta.changes,
      fields: delta.fields,
    },
  };
}

export function buildActionLogEntry(input: BuildActionLogEntryInput): BoardActionLogEntry | null {
  if (input.action === 'create' || input.action === 'paste' || input.action === 'duplicate') {
    const object = input.object || input.after;
    if (!object) {
      return null;
    }

    return buildCreateLog(
      input.source,
      input.action,
      object,
      input.sourceObjectId,
      input.actorUserId,
    );
  }

  if (input.action === 'delete') {
    const before = input.before || input.object;
    if (!before) {
      return null;
    }

    return buildDeleteLog(input.source, before, input.actorUserId);
  }

  if (input.action === 'copy') {
    const object = input.object || input.before;
    if (!object) {
      return null;
    }

    return buildCopyLog(input.source, object, input.actorUserId);
  }

  if (input.action === 'update') {
    if (!input.before || !input.after) {
      return null;
    }

    return buildUpdateLog(input.source, input.before, input.after, input.actorUserId);
  }

  return null;
}
