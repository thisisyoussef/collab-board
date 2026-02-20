import { describe, expect, it } from 'vitest';
import type { BoardObject } from '../types/board';
import {
  getConnectorArrowHead,
  getConnectorPathBounds,
  getConnectorPathType,
  getConnectorPoints,
  getConnectorRoutingObstacles,
  getConnectorStrokeStyle,
  findHoveredShapeId,
  isConnectorDashed,
  isSameConnectorAnchor,
} from './board-connector-helpers';

function makeConnector(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: 'conn-1',
    type: 'connector',
    x: 0,
    y: 0,
    width: 120,
    height: 0,
    rotation: 0,
    zIndex: 1,
    createdBy: 'user-1',
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as BoardObject;
}

function makeRect(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: 'rect-1',
    type: 'rect',
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    rotation: 0,
    zIndex: 1,
    createdBy: 'user-1',
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as BoardObject;
}

describe('getConnectorPoints', () => {
  it('returns endpoints from connector.points', () => {
    const connector = makeConnector({ points: [10, 20, 30, 40] });
    expect(getConnectorPoints(connector)).toEqual([10, 20, 30, 40]);
  });

  it('falls back to x/y → x+width/y when no points', () => {
    const connector = makeConnector({ x: 5, y: 10, width: 100, height: 0, points: undefined });
    expect(getConnectorPoints(connector)).toEqual([5, 10, 105, 10]);
  });
});

describe('getConnectorPathType', () => {
  it('returns stored connectorType when valid', () => {
    expect(getConnectorPathType(makeConnector({ connectorType: 'bent' }))).toBe('bent');
    expect(getConnectorPathType(makeConnector({ connectorType: 'curved' }))).toBe('curved');
    expect(getConnectorPathType(makeConnector({ connectorType: 'straight' }))).toBe('straight');
  });

  it('returns default for unknown connectorType', () => {
    expect(getConnectorPathType(makeConnector({ connectorType: undefined }))).toBe('straight');
    expect(getConnectorPathType(makeConnector({ connectorType: 'invalid' as never }))).toBe('straight');
  });
});

describe('getConnectorStrokeStyle', () => {
  it('returns explicit strokeStyle', () => {
    expect(getConnectorStrokeStyle(makeConnector({ strokeStyle: 'dashed' }))).toBe('dashed');
    expect(getConnectorStrokeStyle(makeConnector({ strokeStyle: 'solid' }))).toBe('solid');
  });

  it('falls back to legacy style=dashed', () => {
    expect(getConnectorStrokeStyle(makeConnector({ style: 'dashed' }))).toBe('dashed');
  });

  it('returns default solid for unknown values', () => {
    expect(getConnectorStrokeStyle(makeConnector({}))).toBe('solid');
  });
});

describe('getConnectorArrowHead', () => {
  it('returns explicit arrow head values', () => {
    expect(getConnectorArrowHead(makeConnector({ startArrow: 'triangle' }), 'start')).toBe('triangle');
    expect(getConnectorArrowHead(makeConnector({ endArrow: 'diamond' }), 'end')).toBe('diamond');
    expect(getConnectorArrowHead(makeConnector({ endArrow: 'none' }), 'end')).toBe('none');
  });

  it('falls back to legacy style=arrow for end arrow', () => {
    expect(getConnectorArrowHead(makeConnector({ style: 'arrow' }), 'end')).toBe('solid');
  });

  it('returns defaults when not specified', () => {
    expect(getConnectorArrowHead(makeConnector({}), 'start')).toBe('none');
    expect(getConnectorArrowHead(makeConnector({}), 'end')).toBe('solid');
  });
});

describe('isConnectorDashed', () => {
  it('returns true for dashed style', () => {
    expect(isConnectorDashed(makeConnector({ strokeStyle: 'dashed' }))).toBe(true);
  });

  it('returns false for solid style', () => {
    expect(isConnectorDashed(makeConnector({ strokeStyle: 'solid' }))).toBe(false);
  });
});

describe('getConnectorPathBounds', () => {
  it('computes bounding box from points', () => {
    expect(getConnectorPathBounds([0, 0, 100, 50])).toEqual({ width: 100, height: 50 });
  });

  it('handles multi-point paths', () => {
    expect(getConnectorPathBounds([10, 20, 50, 80, 90, 30])).toEqual({ width: 80, height: 60 });
  });

  it('returns minimum dimensions for too-few points', () => {
    expect(getConnectorPathBounds([0, 0])).toEqual({ width: 120, height: 1 });
  });

  it('ensures minimum width/height of 1', () => {
    expect(getConnectorPathBounds([10, 10, 10, 10])).toEqual({ width: 1, height: 1 });
  });
});

describe('isSameConnectorAnchor', () => {
  it('returns true for matching anchors', () => {
    expect(
      isSameConnectorAnchor(
        { objectId: 'a', anchorX: 0.5, anchorY: 0.5 },
        { objectId: 'a', anchorX: 0.5, anchorY: 0.5 },
      ),
    ).toBe(true);
  });

  it('returns false for different objectIds', () => {
    expect(
      isSameConnectorAnchor(
        { objectId: 'a', anchorX: 0.5, anchorY: 0.5 },
        { objectId: 'b', anchorX: 0.5, anchorY: 0.5 },
      ),
    ).toBe(false);
  });

  it('returns true for nearly-equal anchor positions within epsilon', () => {
    expect(
      isSameConnectorAnchor(
        { objectId: 'a', anchorX: 0.5, anchorY: 0.5 },
        { objectId: 'a', anchorX: 0.5001, anchorY: 0.4999 },
      ),
    ).toBe(true);
  });

  it('returns false for anchor positions outside epsilon', () => {
    expect(
      isSameConnectorAnchor(
        { objectId: 'a', anchorX: 0.0, anchorY: 0.5 },
        { objectId: 'a', anchorX: 1.0, anchorY: 0.5 },
      ),
    ).toBe(false);
  });
});

describe('getConnectorRoutingObstacles', () => {
  it('excludes the connector itself and other connectors', () => {
    const objects = new Map<string, BoardObject>([
      ['conn-1', makeConnector({ id: 'conn-1' })],
      ['conn-2', makeConnector({ id: 'conn-2' })],
      ['rect-1', makeRect({ id: 'rect-1', x: 10, y: 20, width: 30, height: 40 })],
    ]);
    const obstacles = getConnectorRoutingObstacles(objects, makeConnector({ id: 'conn-1' }));
    expect(obstacles).toHaveLength(1);
    expect(obstacles[0]).toMatchObject({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('excludes from/to attached objects', () => {
    const objects = new Map<string, BoardObject>([
      ['conn-1', makeConnector({ id: 'conn-1', fromId: 'rect-1', toId: 'rect-2' })],
      ['rect-1', makeRect({ id: 'rect-1' })],
      ['rect-2', makeRect({ id: 'rect-2', x: 400, y: 400 })],
      ['rect-3', makeRect({ id: 'rect-3', x: 200, y: 200 })],
    ]);
    const obstacles = getConnectorRoutingObstacles(
      objects,
      makeConnector({ id: 'conn-1', fromId: 'rect-1', toId: 'rect-2' }),
    );
    expect(obstacles).toHaveLength(1);
    expect(obstacles[0]).toMatchObject({ x: 200, y: 200 });
  });
});

describe('findHoveredShapeId', () => {
  it('returns the id of a shape under the point', () => {
    const objects = new Map<string, BoardObject>([
      ['rect-1', makeRect({ id: 'rect-1', x: 0, y: 0, width: 100, height: 100 })],
    ]);
    expect(findHoveredShapeId(objects, { x: 50, y: 50 }, 'conn-1')).toBe('rect-1');
  });

  it('returns null when no shape is under the point', () => {
    const objects = new Map<string, BoardObject>([
      ['rect-1', makeRect({ id: 'rect-1', x: 0, y: 0, width: 100, height: 100 })],
    ]);
    expect(findHoveredShapeId(objects, { x: 200, y: 200 }, 'conn-1')).toBeNull();
  });

  it('ignores the connector itself and other connectors', () => {
    const objects = new Map<string, BoardObject>([
      ['conn-1', makeConnector({ id: 'conn-1', x: 0, y: 0, width: 100, height: 100 })],
      ['conn-2', makeConnector({ id: 'conn-2', x: 0, y: 0, width: 100, height: 100 })],
    ]);
    expect(findHoveredShapeId(objects, { x: 50, y: 50 }, 'conn-1')).toBeNull();
  });
});
