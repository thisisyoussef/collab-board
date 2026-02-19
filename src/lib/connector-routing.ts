export type ConnectorPathType = 'straight' | 'bent' | 'curved';

export interface ConnectorObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ConnectorPoint {
  x: number;
  y: number;
}

interface RouteOrthogonalPathInput {
  start: ConnectorPoint;
  end: ConnectorPoint;
  obstacles: ConnectorObstacle[];
  clearance?: number;
  turnPenalty?: number;
  via?: ConnectorPoint;
}

interface BuildConnectorRenderPointsInput extends RouteOrthogonalPathInput {
  type: ConnectorPathType;
  curveOffset?: number;
  controlPoint?: ConnectorPoint;
}

interface GridNode {
  x: number;
  y: number;
}

type Direction = 'start' | 'horizontal' | 'vertical';

interface SearchState {
  nodeIndex: number;
  direction: Direction;
}

const EPSILON = 0.001;
const DEFAULT_TURN_PENALTY = 16;
const DEFAULT_CLEARANCE = 10;

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function toPairPoints(points: number[]): ConnectorPoint[] {
  const next: ConnectorPoint[] = [];
  for (let index = 0; index < points.length - 1; index += 2) {
    const x = Number(points[index]);
    const y = Number(points[index + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }
    next.push({ x, y });
  }
  return next;
}

function fromPairPoints(points: ConnectorPoint[]): number[] {
  const next: number[] = [];
  points.forEach((point) => {
    next.push(point.x, point.y);
  });
  return next;
}

function normalizeObstacle(obstacle: ConnectorObstacle): ConnectorObstacle {
  const width = Math.max(0, Number(obstacle.width) || 0);
  const height = Math.max(0, Number(obstacle.height) || 0);
  return {
    x: Number(obstacle.x) || 0,
    y: Number(obstacle.y) || 0,
    width,
    height,
  };
}

function inflateObstacle(obstacle: ConnectorObstacle, padding: number): ConnectorObstacle {
  const normalized = normalizeObstacle(obstacle);
  if (padding <= 0) {
    return normalized;
  }
  return {
    x: normalized.x - padding,
    y: normalized.y - padding,
    width: normalized.width + padding * 2,
    height: normalized.height + padding * 2,
  };
}

function isPointStrictlyInsideObstacle(point: ConnectorPoint, obstacle: ConnectorObstacle): boolean {
  return (
    point.x > obstacle.x + EPSILON &&
    point.x < obstacle.x + obstacle.width - EPSILON &&
    point.y > obstacle.y + EPSILON &&
    point.y < obstacle.y + obstacle.height - EPSILON
  );
}

function overlapsOpenInterval(a1: number, a2: number, b1: number, b2: number): boolean {
  const low = Math.max(Math.min(a1, a2), Math.min(b1, b2));
  const high = Math.min(Math.max(a1, a2), Math.max(b1, b2));
  return high - low > EPSILON;
}

function segmentIntersectsObstacleInterior(
  a: ConnectorPoint,
  b: ConnectorPoint,
  obstacle: ConnectorObstacle,
): boolean {
  if (Math.abs(a.y - b.y) <= EPSILON) {
    const y = a.y;
    if (y <= obstacle.y + EPSILON || y >= obstacle.y + obstacle.height - EPSILON) {
      return false;
    }
    return overlapsOpenInterval(a.x, b.x, obstacle.x, obstacle.x + obstacle.width);
  }

  if (Math.abs(a.x - b.x) <= EPSILON) {
    const x = a.x;
    if (x <= obstacle.x + EPSILON || x >= obstacle.x + obstacle.width - EPSILON) {
      return false;
    }
    return overlapsOpenInterval(a.y, b.y, obstacle.y, obstacle.y + obstacle.height);
  }

  return false;
}

function segmentBlockedByObstacles(
  a: ConnectorPoint,
  b: ConnectorPoint,
  obstacles: ConnectorObstacle[],
): boolean {
  for (let index = 0; index < obstacles.length; index += 1) {
    if (segmentIntersectsObstacleInterior(a, b, obstacles[index])) {
      return true;
    }
  }
  return false;
}

function segmentLength(a: ConnectorPoint, b: ConnectorPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function manhattanDistance(a: ConnectorPoint, b: ConnectorPoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function directionBetween(a: ConnectorPoint, b: ConnectorPoint): Direction {
  return Math.abs(a.y - b.y) <= EPSILON ? 'horizontal' : 'vertical';
}

function stateKey(state: SearchState): string {
  return `${state.nodeIndex}:${state.direction}`;
}

function parseStateKey(key: string): SearchState {
  const [indexRaw, directionRaw] = key.split(':');
  const nodeIndex = Number(indexRaw);
  const direction = directionRaw as Direction;
  return {
    nodeIndex: Number.isFinite(nodeIndex) ? nodeIndex : 0,
    direction:
      direction === 'horizontal' || direction === 'vertical' || direction === 'start'
        ? direction
        : 'start',
  };
}

function reconstructNodePath(cameFrom: Map<string, string>, currentKey: string): number[] {
  const path: number[] = [];
  let key = currentKey;
  while (true) {
    const current = parseStateKey(key);
    path.push(current.nodeIndex);
    const previous = cameFrom.get(key);
    if (!previous) {
      break;
    }
    key = previous;
  }
  path.reverse();
  return path;
}

function fallbackOrthogonalPath(
  start: ConnectorPoint,
  end: ConnectorPoint,
  obstacles: ConnectorObstacle[],
  clearance: number,
): number[] {
  const candidates: number[][] = [
    [start.x, start.y, end.x, start.y, end.x, end.y],
    [start.x, start.y, start.x, end.y, end.x, end.y],
  ];

  const obstacleTop = Math.min(...obstacles.map((entry) => entry.y), start.y, end.y) - clearance * 2;
  const obstacleBottom =
    Math.max(...obstacles.map((entry) => entry.y + entry.height), start.y, end.y) + clearance * 2;
  candidates.push([start.x, start.y, start.x, obstacleTop, end.x, obstacleTop, end.x, end.y]);
  candidates.push([start.x, start.y, start.x, obstacleBottom, end.x, obstacleBottom, end.x, end.y]);

  let best = candidates[0];
  let bestScore = Number.POSITIVE_INFINITY;
  candidates.forEach((points) => {
    let blockedSegments = 0;
    for (let index = 0; index < points.length - 2; index += 2) {
      const a = { x: points[index], y: points[index + 1] };
      const b = { x: points[index + 2], y: points[index + 3] };
      if (segmentBlockedByObstacles(a, b, obstacles)) {
        blockedSegments += 1;
      }
    }
    const score = blockedSegments * 10_000 + simplifyConnectorPath(points).length;
    if (score < bestScore) {
      best = points;
      bestScore = score;
    }
  });

  return simplifyConnectorPath(best);
}

export function simplifyConnectorPath(points: number[]): number[] {
  const pairPoints = toPairPoints(points);
  if (pairPoints.length <= 2) {
    return fromPairPoints(pairPoints);
  }

  const deduped: ConnectorPoint[] = [];
  pairPoints.forEach((point) => {
    const previous = deduped[deduped.length - 1];
    if (!previous || Math.abs(previous.x - point.x) > EPSILON || Math.abs(previous.y - point.y) > EPSILON) {
      deduped.push(point);
    }
  });

  if (deduped.length <= 2) {
    return fromPairPoints(deduped);
  }

  const simplified: ConnectorPoint[] = [deduped[0]];
  for (let index = 1; index < deduped.length - 1; index += 1) {
    const previous = simplified[simplified.length - 1];
    const current = deduped[index];
    const next = deduped[index + 1];

    const previousDirection = directionBetween(previous, current);
    const nextDirection = directionBetween(current, next);
    if (
      previousDirection === nextDirection &&
      (Math.abs(previous.x - current.x) <= EPSILON || Math.abs(previous.y - current.y) <= EPSILON)
    ) {
      continue;
    }

    simplified.push(current);
  }
  simplified.push(deduped[deduped.length - 1]);

  return fromPairPoints(simplified);
}

export function routeOrthogonalPath({
  start,
  end,
  obstacles,
  clearance = DEFAULT_CLEARANCE,
  turnPenalty = DEFAULT_TURN_PENALTY,
  via,
}: RouteOrthogonalPathInput): number[] {
  if (via) {
    const first = routeOrthogonalPath({
      start,
      end: via,
      obstacles,
      clearance,
      turnPenalty,
    });
    const second = routeOrthogonalPath({
      start: via,
      end,
      obstacles,
      clearance,
      turnPenalty,
    });

    if (first.length >= 4 && second.length >= 4) {
      return simplifyConnectorPath([...first, ...second.slice(2)]);
    }
  }

  const normalizedObstacles = obstacles.map((entry) => inflateObstacle(entry, clearance));
  const xValues = new Set<number>([start.x, end.x]);
  const yValues = new Set<number>([start.y, end.y]);

  normalizedObstacles.forEach((obstacle) => {
    xValues.add(obstacle.x);
    xValues.add(obstacle.x + obstacle.width);
    yValues.add(obstacle.y);
    yValues.add(obstacle.y + obstacle.height);
  });

  const xs = Array.from(xValues).sort((a, b) => a - b);
  const ys = Array.from(yValues).sort((a, b) => a - b);
  const nodes: GridNode[] = [];
  const nodeIndexByKey = new Map<string, number>();

  function addNode(point: ConnectorPoint) {
    const key = `${point.x}|${point.y}`;
    if (nodeIndexByKey.has(key)) {
      return;
    }

    const insideObstacle = normalizedObstacles.some((obstacle) => isPointStrictlyInsideObstacle(point, obstacle));
    if (insideObstacle) {
      return;
    }

    nodeIndexByKey.set(key, nodes.length);
    nodes.push(point);
  }

  xs.forEach((x) => {
    ys.forEach((y) => {
      addNode({ x, y });
    });
  });

  addNode(start);
  addNode(end);

  const startIndex = nodeIndexByKey.get(`${start.x}|${start.y}`);
  const endIndex = nodeIndexByKey.get(`${end.x}|${end.y}`);
  if (startIndex === undefined || endIndex === undefined) {
    return fallbackOrthogonalPath(start, end, normalizedObstacles, clearance);
  }

  const neighbors = new Map<number, number[]>();
  nodes.forEach((_, index) => {
    neighbors.set(index, []);
  });

  function connectIndices(aIndex: number, bIndex: number) {
    const a = nodes[aIndex];
    const b = nodes[bIndex];
    if (!a || !b) {
      return;
    }
    if (Math.abs(a.x - b.x) > EPSILON && Math.abs(a.y - b.y) > EPSILON) {
      return;
    }
    if (segmentBlockedByObstacles(a, b, normalizedObstacles)) {
      return;
    }
    neighbors.get(aIndex)?.push(bIndex);
    neighbors.get(bIndex)?.push(aIndex);
  }

  const rowMap = new Map<number, number[]>();
  const colMap = new Map<number, number[]>();
  nodes.forEach((node, index) => {
    if (!rowMap.has(node.y)) {
      rowMap.set(node.y, []);
    }
    if (!colMap.has(node.x)) {
      colMap.set(node.x, []);
    }
    rowMap.get(node.y)?.push(index);
    colMap.get(node.x)?.push(index);
  });

  rowMap.forEach((indices) => {
    indices
      .slice()
      .sort((a, b) => nodes[a].x - nodes[b].x)
      .forEach((index, position, sorted) => {
        if (position >= sorted.length - 1) {
          return;
        }
        connectIndices(index, sorted[position + 1]);
      });
  });

  colMap.forEach((indices) => {
    indices
      .slice()
      .sort((a, b) => nodes[a].y - nodes[b].y)
      .forEach((index, position, sorted) => {
        if (position >= sorted.length - 1) {
          return;
        }
        connectIndices(index, sorted[position + 1]);
      });
  });

  const startState: SearchState = { nodeIndex: startIndex, direction: 'start' };
  const startStateKey = stateKey(startState);
  const openSet = new Set<string>([startStateKey]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startStateKey, 0]]);
  const fScore = new Map<string, number>([[startStateKey, manhattanDistance(start, end)]]);

  const maxIterations = Math.max(1_000, nodes.length * 20);
  let iterations = 0;

  while (openSet.size > 0 && iterations < maxIterations) {
    iterations += 1;
    let currentKey = '';
    let currentBest = Number.POSITIVE_INFINITY;
    openSet.forEach((key) => {
      const score = fScore.get(key) ?? Number.POSITIVE_INFINITY;
      if (score < currentBest) {
        currentBest = score;
        currentKey = key;
      }
    });

    if (!currentKey) {
      break;
    }

    const currentState = parseStateKey(currentKey);
    if (currentState.nodeIndex === endIndex) {
      const pathIndices = reconstructNodePath(cameFrom, currentKey);
      const pathPoints = pathIndices.map((index) => nodes[index]);
      return simplifyConnectorPath(fromPairPoints(pathPoints));
    }

    openSet.delete(currentKey);
    const currentNode = nodes[currentState.nodeIndex];
    const currentG = gScore.get(currentKey) ?? Number.POSITIVE_INFINITY;
    const nextIndices = neighbors.get(currentState.nodeIndex) ?? [];
    nextIndices.forEach((nextIndex) => {
      const nextNode = nodes[nextIndex];
      const direction = directionBetween(currentNode, nextNode);
      const turnCost =
        currentState.direction !== 'start' && currentState.direction !== direction ? turnPenalty : 0;
      const tentativeG = currentG + segmentLength(currentNode, nextNode) + turnCost;
      const nextState: SearchState = { nodeIndex: nextIndex, direction };
      const nextKey = stateKey(nextState);

      if (tentativeG >= (gScore.get(nextKey) ?? Number.POSITIVE_INFINITY)) {
        return;
      }

      cameFrom.set(nextKey, currentKey);
      gScore.set(nextKey, tentativeG);
      fScore.set(nextKey, tentativeG + manhattanDistance(nextNode, end));
      openSet.add(nextKey);
    });
  }

  return fallbackOrthogonalPath(start, end, normalizedObstacles, clearance);
}

function buildCurvedPathPoints(
  start: ConnectorPoint,
  end: ConnectorPoint,
  curveOffset: number | undefined,
  controlPoint?: ConnectorPoint,
): number[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  const offset = Number.isFinite(curveOffset)
    ? Number(curveOffset)
    : clamp(distance * 0.28, 40, 180);

  let perpendicularX = 0;
  let perpendicularY = -1;
  if (distance > EPSILON) {
    perpendicularX = -dy / distance;
    perpendicularY = dx / distance;
  }

  const middle = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  const curveCenter = controlPoint || {
    x: middle.x + perpendicularX * offset,
    y: middle.y + perpendicularY * offset,
  };

  const controlA = {
    x: (start.x + curveCenter.x) / 2,
    y: (start.y + curveCenter.y) / 2,
  };
  const controlB = {
    x: (end.x + curveCenter.x) / 2,
    y: (end.y + curveCenter.y) / 2,
  };

  return [start.x, start.y, controlA.x, controlA.y, controlB.x, controlB.y, end.x, end.y];
}

export function buildConnectorRenderPoints({
  type,
  start,
  end,
  obstacles,
  clearance = DEFAULT_CLEARANCE,
  turnPenalty = DEFAULT_TURN_PENALTY,
  curveOffset,
  controlPoint,
}: BuildConnectorRenderPointsInput): number[] {
  if (type === 'curved') {
    return buildCurvedPathPoints(start, end, curveOffset, controlPoint);
  }

  if (type === 'bent') {
    return routeOrthogonalPath({
      start,
      end,
      obstacles,
      clearance,
      turnPenalty,
      via: controlPoint,
    });
  }

  return [start.x, start.y, end.x, end.y];
}

export function getConnectorEndpoints(points: number[]): {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
} {
  const normalized = toPairPoints(points);
  if (normalized.length === 0) {
    return { startX: 0, startY: 0, endX: 0, endY: 0 };
  }

  const start = normalized[0];
  const end = normalized[normalized.length - 1];
  return {
    startX: start.x,
    startY: start.y,
    endX: end.x,
    endY: end.y,
  };
}

export function getPointAlongConnectorPath(points: number[], positionPercent: number): ConnectorPoint {
  const normalized = toPairPoints(points);
  if (normalized.length === 0) {
    return { x: 0, y: 0 };
  }
  if (normalized.length === 1) {
    return normalized[0];
  }

  const clampedPercent = clamp(Number(positionPercent) || 0, 0, 100);
  if (clampedPercent <= 0) {
    return normalized[0];
  }
  if (clampedPercent >= 100) {
    return normalized[normalized.length - 1];
  }

  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const length = segmentLength(normalized[index], normalized[index + 1]);
    segmentLengths.push(length);
    totalLength += length;
  }

  if (totalLength <= EPSILON) {
    return normalized[0];
  }

  const targetLength = (clampedPercent / 100) * totalLength;
  let consumed = 0;

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLengthValue = segmentLengths[index];
    const start = normalized[index];
    const end = normalized[index + 1];
    const nextConsumed = consumed + segmentLengthValue;
    if (targetLength <= nextConsumed || index === segmentLengths.length - 1) {
      const remaining = targetLength - consumed;
      const t = segmentLengthValue <= EPSILON ? 0 : remaining / segmentLengthValue;
      return {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      };
    }
    consumed = nextConsumed;
  }

  return normalized[normalized.length - 1];
}
