import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  cloneObjects,
  relinkConnectors,
  serializeToClipboard,
  deserializeFromClipboard,
  CLIPBOARD_STORAGE_KEY,
} from './board-clipboard';
import type { BoardObject } from '../types/board';

function makeSticky(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: overrides.id || 'sticky-1',
    type: 'sticky',
    x: 100,
    y: 200,
    width: 150,
    height: 100,
    rotation: 0,
    text: 'Hello',
    color: '#FFEB3B',
    fontSize: 14,
    zIndex: 1,
    createdBy: 'user-1',
    updatedAt: '2026-02-19T00:00:00.000Z',
    ...overrides,
  };
}

function makeRect(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: overrides.id || 'rect-1',
    type: 'rect',
    x: 300,
    y: 400,
    width: 180,
    height: 120,
    rotation: 45,
    color: '#E3F2FD',
    stroke: '#1565C0',
    strokeWidth: 2,
    zIndex: 2,
    createdBy: 'user-1',
    updatedAt: '2026-02-19T00:00:00.000Z',
    ...overrides,
  };
}

function makeConnector(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: overrides.id || 'conn-1',
    type: 'connector',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    rotation: 0,
    color: '#64748B',
    strokeWidth: 2,
    fromId: 'sticky-1',
    toId: 'rect-1',
    points: [0, 0, 100, 50],
    zIndex: 3,
    createdBy: 'user-1',
    updatedAt: '2026-02-19T00:00:00.000Z',
    ...overrides,
  };
}

function makeLine(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: overrides.id || 'line-1',
    type: 'line',
    x: 50,
    y: 60,
    width: 140,
    height: 8,
    rotation: 0,
    color: '#0F172A',
    strokeWidth: 2,
    points: [0, 0, 140, 0],
    zIndex: 4,
    createdBy: 'user-1',
    updatedAt: '2026-02-19T00:00:00.000Z',
    ...overrides,
  };
}

function makeText(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: overrides.id || 'text-1',
    type: 'text',
    x: 500,
    y: 100,
    width: 180,
    height: 44,
    rotation: 0,
    text: 'Sample Text',
    color: '#111827',
    fontSize: 20,
    zIndex: 5,
    createdBy: 'user-1',
    updatedAt: '2026-02-19T00:00:00.000Z',
    ...overrides,
  };
}

function makeFrame(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: overrides.id || 'frame-1',
    type: 'frame',
    x: 0,
    y: 0,
    width: 360,
    height: 240,
    rotation: 0,
    color: '#FFFFFF',
    stroke: '#334155',
    strokeWidth: 2,
    title: 'My Frame',
    zIndex: 0,
    createdBy: 'user-1',
    updatedAt: '2026-02-19T00:00:00.000Z',
    ...overrides,
  };
}

function makeCircle(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: overrides.id || 'circle-1',
    type: 'circle',
    x: 200,
    y: 200,
    width: 120,
    height: 120,
    rotation: 0,
    color: '#E0F2FE',
    stroke: '#1565C0',
    strokeWidth: 2,
    radius: 60,
    zIndex: 6,
    createdBy: 'user-1',
    updatedAt: '2026-02-19T00:00:00.000Z',
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────
// cloneObjects
// ────────────────────────────────────────────────────────────

describe('cloneObjects', () => {
  it('generates new unique IDs for all clones', () => {
    const originals = [makeSticky(), makeRect()];
    const clones = cloneObjects(originals, { dx: 20, dy: 20 });

    expect(clones).toHaveLength(2);
    expect(clones[0].id).not.toBe(originals[0].id);
    expect(clones[1].id).not.toBe(originals[1].id);
    expect(clones[0].id).not.toBe(clones[1].id);
  });

  it('applies offset to x/y positions', () => {
    const originals = [makeSticky({ x: 100, y: 200 })];
    const clones = cloneObjects(originals, { dx: 20, dy: 30 });

    expect(clones[0].x).toBe(120);
    expect(clones[0].y).toBe(230);
  });

  it('preserves all attributes (color, text, rotation, etc.)', () => {
    const original = makeSticky({
      text: 'Keep this text',
      color: '#FF0000',
      rotation: 15,
      fontSize: 18,
    });
    const clones = cloneObjects([original], { dx: 20, dy: 20 });

    expect(clones[0].type).toBe('sticky');
    expect(clones[0].text).toBe('Keep this text');
    expect(clones[0].color).toBe('#FF0000');
    expect(clones[0].rotation).toBe(15);
    expect(clones[0].fontSize).toBe(18);
    expect(clones[0].width).toBe(original.width);
    expect(clones[0].height).toBe(original.height);
  });

  it('updates updatedAt timestamp on clones', () => {
    const originals = [makeSticky({ updatedAt: '2020-01-01T00:00:00.000Z' })];
    const clones = cloneObjects(originals, { dx: 20, dy: 20 });

    expect(clones[0].updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('works for all 7 object types', () => {
    const originals = [
      makeSticky(),
      makeRect(),
      makeCircle(),
      makeLine(),
      makeText(),
      makeFrame(),
      makeConnector(),
    ];
    const clones = cloneObjects(originals, { dx: 10, dy: 10 });

    expect(clones).toHaveLength(7);
    clones.forEach((clone, i) => {
      expect(clone.type).toBe(originals[i].type);
      expect(clone.id).not.toBe(originals[i].id);
      expect(clone.x).toBe(originals[i].x + 10);
      expect(clone.y).toBe(originals[i].y + 10);
    });
  });

  it('preserves relative positions in multi-select clone', () => {
    const s1 = makeSticky({ id: 's1', x: 100, y: 100 });
    const s2 = makeSticky({ id: 's2', x: 200, y: 300 });

    const clones = cloneObjects([s1, s2], { dx: 20, dy: 20 });

    const deltaX = clones[1].x - clones[0].x;
    const deltaY = clones[1].y - clones[0].y;

    // Original relative: (200-100, 300-100) = (100, 200)
    expect(deltaX).toBe(100);
    expect(deltaY).toBe(200);
  });

  it('preserves connector-specific properties (points, styles)', () => {
    const original = makeConnector({
      style: 'dashed',
      strokeWidth: 3,
      points: [0, 0, 50, 50],
    });
    const clones = cloneObjects([original], { dx: 10, dy: 10 });

    expect(clones[0].style).toBe('dashed');
    expect(clones[0].strokeWidth).toBe(3);
    expect(clones[0].points).toEqual([0, 0, 50, 50]);
  });

  it('preserves frame title', () => {
    const original = makeFrame({ title: 'Ideas Section' });
    const clones = cloneObjects([original], { dx: 20, dy: 20 });

    expect(clones[0].title).toBe('Ideas Section');
  });
});

// ────────────────────────────────────────────────────────────
// relinkConnectors
// ────────────────────────────────────────────────────────────

describe('relinkConnectors', () => {
  it('maps old IDs to new IDs for connectors whose endpoints are in selection', () => {
    const origSticky = makeSticky({ id: 'orig-s' });
    const origRect = makeRect({ id: 'orig-r' });
    const origConn = makeConnector({ id: 'orig-c', fromId: 'orig-s', toId: 'orig-r' });

    const clonedSticky = { ...origSticky, id: 'clone-s' };
    const clonedRect = { ...origRect, id: 'clone-r' };
    const clonedConn = { ...origConn, id: 'clone-c', fromId: 'orig-s', toId: 'orig-r' };

    const originals = [origSticky, origRect, origConn];
    const clones = [clonedSticky, clonedRect, clonedConn];

    relinkConnectors(originals, clones);

    expect(clonedConn.fromId).toBe('clone-s');
    expect(clonedConn.toId).toBe('clone-r');
  });

  it('clears fromId/toId for connectors whose targets are NOT in selection', () => {
    // Connector alone without its endpoints in the selection
    const origConn = makeConnector({ id: 'orig-c', fromId: 'external-a', toId: 'external-b' });
    const clonedConn = { ...origConn, id: 'clone-c' };

    const originals = [origConn];
    const clones = [clonedConn];

    relinkConnectors(originals, clones);

    expect(clonedConn.fromId).toBe('');
    expect(clonedConn.toId).toBe('');
  });

  it('handles partial selection (one endpoint in selection, one not)', () => {
    const origSticky = makeSticky({ id: 'orig-s' });
    const origConn = makeConnector({ id: 'orig-c', fromId: 'orig-s', toId: 'external-b' });

    const clonedSticky = { ...origSticky, id: 'clone-s' };
    const clonedConn = { ...origConn, id: 'clone-c' };

    const originals = [origSticky, origConn];
    const clones = [clonedSticky, clonedConn];

    relinkConnectors(originals, clones);

    expect(clonedConn.fromId).toBe('clone-s');
    expect(clonedConn.toId).toBe('');
  });

  it('does not modify non-connector clones', () => {
    const origSticky = makeSticky({ id: 'orig-s' });
    const clonedSticky = { ...origSticky, id: 'clone-s' };

    const originals = [origSticky];
    const clones = [clonedSticky];

    relinkConnectors(originals, clones);

    // Should be unchanged
    expect(clonedSticky.id).toBe('clone-s');
    expect(clonedSticky.type).toBe('sticky');
  });
});

// ────────────────────────────────────────────────────────────
// serializeToClipboard / deserializeFromClipboard
// ────────────────────────────────────────────────────────────

describe('clipboard serialization', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('roundtrip preserves data', () => {
    const objects = [makeSticky(), makeRect()];
    serializeToClipboard(objects);
    const deserialized = deserializeFromClipboard();

    expect(deserialized).not.toBeNull();
    expect(deserialized).toHaveLength(2);
    expect(deserialized![0].id).toBe(objects[0].id);
    expect(deserialized![0].type).toBe('sticky');
    expect(deserialized![0].text).toBe('Hello');
    expect(deserialized![1].id).toBe(objects[1].id);
    expect(deserialized![1].type).toBe('rect');
  });

  it('returns null for empty clipboard', () => {
    const result = deserializeFromClipboard();
    expect(result).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    sessionStorage.setItem(CLIPBOARD_STORAGE_KEY, 'not valid json {{');
    const result = deserializeFromClipboard();
    expect(result).toBeNull();
  });

  it('returns null for wrong version', () => {
    sessionStorage.setItem(
      CLIPBOARD_STORAGE_KEY,
      JSON.stringify({ version: 99, objects: [], copiedAt: Date.now() }),
    );
    const result = deserializeFromClipboard();
    expect(result).toBeNull();
  });

  it('returns null for payload missing objects array', () => {
    sessionStorage.setItem(
      CLIPBOARD_STORAGE_KEY,
      JSON.stringify({ version: 1, copiedAt: Date.now() }),
    );
    const result = deserializeFromClipboard();
    expect(result).toBeNull();
  });

  it('returns null for empty objects array', () => {
    sessionStorage.setItem(
      CLIPBOARD_STORAGE_KEY,
      JSON.stringify({ version: 1, objects: [], copiedAt: Date.now() }),
    );
    const result = deserializeFromClipboard();
    expect(result).toBeNull();
  });

  it('handles all 7 object types in roundtrip', () => {
    const objects = [
      makeSticky(),
      makeRect(),
      makeCircle(),
      makeLine(),
      makeText(),
      makeFrame(),
      makeConnector(),
    ];
    serializeToClipboard(objects);
    const result = deserializeFromClipboard();

    expect(result).toHaveLength(7);
    result!.forEach((obj, i) => {
      expect(obj.type).toBe(objects[i].type);
    });
  });
});
