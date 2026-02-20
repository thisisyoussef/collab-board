import { describe, expect, it } from 'vitest';
import type { BoardObject } from '../types/board';
import {
  buildActionLogEntry,
  buildBoardPositionsSnapshot,
  buildBoardPositionsSnapshotLogEntry,
  describeBoardObjectDelta,
  formatObjectLabel,
} from './board-action-log';

function makeObject(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: overrides.id || 'obj-1',
    type: overrides.type || 'sticky',
    x: 100,
    y: 200,
    width: 150,
    height: 100,
    rotation: 0,
    color: '#FFEB3B',
    zIndex: 1,
    createdBy: 'user-1',
    updatedAt: '2026-02-20T12:00:00.000Z',
    ...overrides,
  };
}

describe('formatObjectLabel', () => {
  it('returns readable labels for all object types', () => {
    expect(formatObjectLabel('sticky')).toBe('Sticky note');
    expect(formatObjectLabel('rect')).toBe('Rectangle');
    expect(formatObjectLabel('circle')).toBe('Circle');
    expect(formatObjectLabel('line')).toBe('Line');
    expect(formatObjectLabel('text')).toBe('Text');
    expect(formatObjectLabel('frame')).toBe('Frame');
    expect(formatObjectLabel('connector')).toBe('Connector');
  });
});

describe('describeBoardObjectDelta', () => {
  it('describes move-only changes', () => {
    const before = makeObject({ id: 'sticky-1', type: 'sticky', x: 100, y: 200 });
    const after = makeObject({ id: 'sticky-1', type: 'sticky', x: 149.7, y: 250.2 });

    const delta = describeBoardObjectDelta(before, after);

    expect(delta).not.toBeNull();
    expect(delta?.changes).toContain('move');
    expect(delta?.changes).not.toContain('resize');
    expect(delta?.changes).not.toContain('rotate');
    expect(delta?.message).toContain("Moved Sticky note 'sticky-1' from (100, 200) to (150, 250).");
  });

  it('describes rotate-only changes', () => {
    const before = makeObject({ id: 'rect-1', type: 'rect', rotation: 12.2 });
    const after = makeObject({ id: 'rect-1', type: 'rect', rotation: 47.8 });

    const delta = describeBoardObjectDelta(before, after);

    expect(delta).not.toBeNull();
    expect(delta?.changes).toContain('rotate');
    expect(delta?.message).toContain("Rotated Rectangle 'rect-1' from 12° to 48°.");
  });

  it('describes resize-only changes', () => {
    const before = makeObject({ id: 'frame-1', type: 'frame', width: 360, height: 240 });
    const after = makeObject({ id: 'frame-1', type: 'frame', width: 510.4, height: 300.6 });

    const delta = describeBoardObjectDelta(before, after);

    expect(delta).not.toBeNull();
    expect(delta?.changes).toContain('resize');
    expect(delta?.message).toContain("Resized Frame 'frame-1' from 360x240 to 510x301.");
  });

  it('describes combined move/resize/rotate changes', () => {
    const before = makeObject({
      id: 'circle-1',
      type: 'circle',
      x: 100,
      y: 100,
      width: 120,
      height: 120,
      rotation: 0,
    });
    const after = makeObject({
      id: 'circle-1',
      type: 'circle',
      x: 220,
      y: 130,
      width: 180,
      height: 180,
      rotation: 23,
    });

    const delta = describeBoardObjectDelta(before, after);

    expect(delta).not.toBeNull();
    expect(delta?.changes).toEqual(['move', 'resize', 'rotate']);
    expect(delta?.message).toContain("Moved Circle 'circle-1' from (100, 100) to (220, 130).");
    expect(delta?.message).toContain("Resized Circle 'circle-1' from 120x120 to 180x180.");
    expect(delta?.message).toContain("Rotated Circle 'circle-1' from 0° to 23°.");
  });

  it('returns null when there are no meaningful changes', () => {
    const before = makeObject({ id: 'text-1', type: 'text' });
    const after = makeObject({ id: 'text-1', type: 'text' });

    const delta = describeBoardObjectDelta(before, after);

    expect(delta).toBeNull();
  });

  it('captures non-geometry changes for update logs', () => {
    const before = makeObject({ id: 'line-1', type: 'line', color: '#000000', strokeWidth: 2 });
    const after = makeObject({ id: 'line-1', type: 'line', color: '#111111', strokeWidth: 4 });

    const delta = describeBoardObjectDelta(before, after);

    expect(delta).not.toBeNull();
    expect(delta?.changes).toEqual(['update']);
    expect(delta?.fields).toContain('color');
    expect(delta?.fields).toContain('strokeWidth');
    expect(delta?.message).toContain("Updated Line 'line-1'");
  });
});

describe('buildActionLogEntry', () => {
  it('builds create message and context', () => {
    const object = makeObject({ id: 'sticky-1', type: 'sticky', x: 99.5, y: 222.2 });

    const entry = buildActionLogEntry({
      source: 'local',
      action: 'create',
      object,
      actorUserId: 'user-1',
    });

    expect(entry).not.toBeNull();
    expect(entry?.message).toBe("Created Sticky note 'sticky-1' at (100, 222).");
    expect(entry?.context).toMatchObject({
      source: 'local',
      action: 'create',
      objectId: 'sticky-1',
      objectType: 'sticky',
      actorUserId: 'user-1',
      after: { x: 100, y: 222 },
    });
  });

  it('builds delete message and context', () => {
    const before = makeObject({ id: 'frame-1', type: 'frame', x: 420.1, y: 510.9 });

    const entry = buildActionLogEntry({
      source: 'remote',
      action: 'delete',
      before,
      actorUserId: 'collab-7',
    });

    expect(entry).not.toBeNull();
    expect(entry?.message).toBe("Deleted Frame 'frame-1' at (420, 511).");
    expect(entry?.context).toMatchObject({
      source: 'remote',
      action: 'delete',
      objectId: 'frame-1',
      objectType: 'frame',
      actorUserId: 'collab-7',
      before: { x: 420, y: 511 },
    });
  });

  it('builds copy message', () => {
    const object = makeObject({ id: 'rect-1', type: 'rect', x: 40, y: 60 });

    const entry = buildActionLogEntry({
      source: 'local',
      action: 'copy',
      object,
    });

    expect(entry).not.toBeNull();
    expect(entry?.message).toBe("Copied Rectangle 'rect-1' from (40, 60).");
    expect(entry?.context).toMatchObject({
      source: 'local',
      action: 'copy',
      objectId: 'rect-1',
      objectType: 'rect',
      before: { x: 40, y: 60 },
    });
  });

  it('builds paste message with sourceObjectId', () => {
    const object = makeObject({ id: 'rect-2', type: 'rect', x: 140, y: 160 });

    const entry = buildActionLogEntry({
      source: 'local',
      action: 'paste',
      object,
      sourceObjectId: 'rect-1',
    });

    expect(entry).not.toBeNull();
    expect(entry?.message).toBe("Pasted Rectangle 'rect-2' at (140, 160) from 'rect-1'.");
    expect(entry?.context).toMatchObject({
      source: 'local',
      action: 'paste',
      objectId: 'rect-2',
      objectType: 'rect',
      sourceObjectId: 'rect-1',
      after: { x: 140, y: 160 },
    });
  });

  it('builds duplicate message with sourceObjectId', () => {
    const object = makeObject({ id: 'line-2', type: 'line', x: 300, y: 400 });

    const entry = buildActionLogEntry({
      source: 'local',
      action: 'duplicate',
      object,
      sourceObjectId: 'line-1',
    });

    expect(entry).not.toBeNull();
    expect(entry?.message).toBe("Duplicated Line 'line-2' at (300, 400) from 'line-1'.");
    expect(entry?.context).toMatchObject({
      source: 'local',
      action: 'duplicate',
      objectId: 'line-2',
      objectType: 'line',
      sourceObjectId: 'line-1',
      after: { x: 300, y: 400 },
    });
  });

  it('builds update message with geometry changes for AI source', () => {
    const before = makeObject({ id: 'shape-1', type: 'rect', x: 100, y: 100, rotation: 10, width: 120, height: 80 });
    const after = makeObject({ id: 'shape-1', type: 'rect', x: 300, y: 280, rotation: 45, width: 180, height: 110 });

    const entry = buildActionLogEntry({
      source: 'ai',
      action: 'update',
      before,
      after,
      actorUserId: 'assistant-1',
    });

    expect(entry).not.toBeNull();
    expect(entry?.message).toContain("Moved Rectangle 'shape-1' from (100, 100) to (300, 280).");
    expect(entry?.message).toContain("Resized Rectangle 'shape-1' from 120x80 to 180x110.");
    expect(entry?.message).toContain("Rotated Rectangle 'shape-1' from 10° to 45°.");
    expect(entry?.context).toMatchObject({
      source: 'ai',
      action: 'update',
      objectId: 'shape-1',
      objectType: 'rect',
      actorUserId: 'assistant-1',
      changes: ['move', 'resize', 'rotate'],
    });
  });

  it('returns null for no-op update', () => {
    const before = makeObject({ id: 'shape-1', type: 'rect' });
    const after = makeObject({ id: 'shape-1', type: 'rect' });

    const entry = buildActionLogEntry({
      source: 'remote',
      action: 'update',
      before,
      after,
    });

    expect(entry).toBeNull();
  });
});

describe('buildBoardPositionsSnapshot', () => {
  it('returns rounded, z-sorted positions for all objects', () => {
    const objects: BoardObject[] = [
      makeObject({
        id: 'b',
        type: 'rect',
        x: 99.6,
        y: 201.2,
        width: 180.3,
        height: 120.8,
        rotation: 12.6,
        zIndex: 2,
      }),
      makeObject({
        id: 'a',
        type: 'sticky',
        x: 10.2,
        y: 20.7,
        width: 150.4,
        height: 99.6,
        rotation: 0.4,
        zIndex: 1,
      }),
    ];

    const snapshot = buildBoardPositionsSnapshot({ objects });

    expect(snapshot.objectCount).toBe(2);
    expect(snapshot.objects).toEqual([
      {
        id: 'a',
        type: 'sticky',
        x: 10,
        y: 21,
        width: 150,
        height: 100,
        rotation: 0,
        zIndex: 1,
        frameId: null,
        centerX: 85,
        centerY: 71,
        right: 160,
        bottom: 121,
        relativeToFrame: null,
        points: null,
        endpointStart: null,
        endpointEnd: null,
        connector: null,
      },
      {
        id: 'b',
        type: 'rect',
        x: 100,
        y: 201,
        width: 180,
        height: 121,
        rotation: 13,
        zIndex: 2,
        frameId: null,
        centerX: 190,
        centerY: 262,
        right: 280,
        bottom: 322,
        relativeToFrame: null,
        points: null,
        endpointStart: null,
        endpointEnd: null,
        connector: null,
      },
    ]);
  });

  it('includes frame memberships and frame child lists via resolvers', () => {
    const frame = makeObject({
      id: 'frame-1',
      type: 'frame',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      zIndex: 1,
    });
    const sticky = makeObject({
      id: 'sticky-1',
      type: 'sticky',
      x: 50,
      y: 60,
      zIndex: 2,
    });
    const text = makeObject({
      id: 'text-1',
      type: 'text',
      x: 500,
      y: 100,
      zIndex: 3,
    });

    const snapshot = buildBoardPositionsSnapshot({
      objects: [frame, sticky, text],
      resolveFrameIdForObject: (object) =>
        object.id === 'sticky-1' ? 'frame-1' : null,
      resolveFrameChildIds: (candidateFrame) =>
        candidateFrame.id === 'frame-1' ? ['sticky-1'] : [],
    });

    expect(snapshot.objects).toEqual([
      expect.objectContaining({ id: 'frame-1', frameId: null, relativeToFrame: null }),
      expect.objectContaining({
        id: 'sticky-1',
        frameId: 'frame-1',
        relativeToFrame: {
          x: 50,
          y: 60,
          right: 200,
          bottom: 160,
        },
      }),
      expect.objectContaining({ id: 'text-1', frameId: null }),
    ]);
    expect(snapshot.frames).toEqual([
      {
        frameId: 'frame-1',
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        rotation: 0,
        childIds: ['sticky-1'],
      },
    ]);
  });

  it('includes line/connector point coordinates and connector metadata', () => {
    const connector = makeObject({
      id: 'connector-1',
      type: 'connector',
      x: 0,
      y: 0,
      width: 291,
      height: 380,
      points: [10.2, 20.7, 300.4, 400.8],
      fromId: 'sticky-1',
      toId: 'frame-1',
      fromAnchorX: 0.5,
      fromAnchorY: 1,
      toAnchorX: 0,
      toAnchorY: 0.5,
      pathControlX: 151.9,
      pathControlY: 208.2,
      zIndex: 10,
    });

    const snapshot = buildBoardPositionsSnapshot({ objects: [connector] });
    expect(snapshot.objects).toEqual([
      {
        id: 'connector-1',
        type: 'connector',
        x: 0,
        y: 0,
        width: 291,
        height: 380,
        rotation: 0,
        zIndex: 10,
        frameId: null,
        centerX: 146,
        centerY: 190,
        right: 291,
        bottom: 380,
        relativeToFrame: null,
        points: [10, 21, 300, 401],
        endpointStart: { x: 10, y: 21 },
        endpointEnd: { x: 300, y: 401 },
        connector: {
          fromId: 'sticky-1',
          toId: 'frame-1',
          fromAnchorX: 0.5,
          fromAnchorY: 1,
          toAnchorX: 0,
          toAnchorY: 0.5,
          pathControlX: 152,
          pathControlY: 208,
        },
      },
    ]);
  });
});

describe('buildBoardPositionsSnapshotLogEntry', () => {
  it('creates board snapshot log entry with source/action metadata', () => {
    const objects: BoardObject[] = [
      makeObject({ id: 'shape-1', type: 'rect', x: 100, y: 200, zIndex: 1 }),
      makeObject({ id: 'shape-2', type: 'circle', x: 300, y: 400, zIndex: 2 }),
    ];

    const entry = buildBoardPositionsSnapshotLogEntry({
      source: 'local',
      action: 'update',
      actorUserId: 'user-1',
      objectIds: ['shape-1'],
      reason: 'frame-drag-end',
      eventActions: [
        {
          objectId: 'shape-1',
          objectType: 'rect',
          action: 'update',
          changes: ['move', 'resize'],
        },
      ],
      objects,
    });

    expect(entry.message).toBe('Board positions after local update.');
    expect(entry.context).toMatchObject({
      source: 'local',
      action: 'update',
      actorUserId: 'user-1',
      objectIds: ['shape-1'],
      reason: 'frame-drag-end',
      eventActions: [
        {
          objectId: 'shape-1',
          objectType: 'rect',
          action: 'update',
          changes: ['move', 'resize'],
        },
      ],
      boardSnapshot: {
        objectCount: 2,
      },
    });
    expect(entry.context).toMatchObject({
      eventActions: [
        {
          objectId: 'shape-1',
          objectType: 'rect',
          action: 'update',
          changes: ['move', 'resize'],
        },
      ],
    });
    expect(
      ((entry.context.boardSnapshot as { objects: Array<{ id: string }> }).objects || []).map(
        (obj) => obj.id,
      ),
    ).toEqual(['shape-1', 'shape-2']);
  });
});
