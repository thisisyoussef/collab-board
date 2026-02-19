import { describe, expect, it } from 'vitest';
import {
  buildConnectorRenderPoints,
  getConnectorEndpoints,
  getPointAlongConnectorPath,
  routeOrthogonalPath,
  simplifyConnectorPath,
  type ConnectorObstacle,
} from './connector-routing';

describe('connector-routing', () => {
  it('builds straight connector points by default', () => {
    const points = buildConnectorRenderPoints({
      type: 'straight',
      start: { x: 100, y: 100 },
      end: { x: 300, y: 220 },
      obstacles: [],
    });

    expect(points).toEqual([100, 100, 300, 220]);
  });

  it('routes bent connectors around simple obstacles', () => {
    const obstacles: ConnectorObstacle[] = [
      {
        x: 180,
        y: 120,
        width: 140,
        height: 120,
      },
    ];

    const points = routeOrthogonalPath({
      start: { x: 120, y: 180 },
      end: { x: 420, y: 180 },
      obstacles,
      turnPenalty: 16,
      clearance: 10,
    });

    expect(points.length).toBeGreaterThanOrEqual(6);
    for (let index = 0; index < points.length - 2; index += 2) {
      const x1 = points[index];
      const y1 = points[index + 1];
      const x2 = points[index + 2];
      const y2 = points[index + 3];
      expect(x1 === x2 || y1 === y2).toBe(true);
    }
  });

  it('prefers fewer turns when the distance is equivalent', () => {
    const points = routeOrthogonalPath({
      start: { x: 100, y: 100 },
      end: { x: 300, y: 200 },
      obstacles: [],
      turnPenalty: 20,
      clearance: 0,
    });

    const simplified = simplifyConnectorPath(points);
    expect(simplified).toEqual([100, 100, 300, 100, 300, 200]);
  });

  it('builds curved connector points with deterministic control handles', () => {
    const points = buildConnectorRenderPoints({
      type: 'curved',
      start: { x: 100, y: 100 },
      end: { x: 300, y: 100 },
      curveOffset: 80,
      obstacles: [],
    });

    expect(points).toHaveLength(8);
    expect(points[0]).toBe(100);
    expect(points[1]).toBe(100);
    expect(points[6]).toBe(300);
    expect(points[7]).toBe(100);
    expect(Math.abs(points[3] - 100)).toBeGreaterThan(1);
  });

  it('gets endpoints from variable-length paths', () => {
    expect(getConnectorEndpoints([10, 20, 30, 40])).toEqual({
      startX: 10,
      startY: 20,
      endX: 30,
      endY: 40,
    });

    expect(getConnectorEndpoints([10, 20, 15, 16, 30, 40])).toEqual({
      startX: 10,
      startY: 20,
      endX: 30,
      endY: 40,
    });
  });

  it('computes points along multi-segment paths for labels', () => {
    const points = [0, 0, 100, 0, 100, 100];
    const start = getPointAlongConnectorPath(points, 0);
    const middle = getPointAlongConnectorPath(points, 50);
    const end = getPointAlongConnectorPath(points, 100);

    expect(start).toEqual({ x: 0, y: 0 });
    expect(middle).toEqual({ x: 100, y: 0 });
    expect(end).toEqual({ x: 100, y: 100 });
  });
});
