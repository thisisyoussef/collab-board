// Frame grouping — runtime containment detection for frame objects.
// An object is "inside" a frame if its center point falls within the frame's bounds.
// Containment is computed on-demand (no stored parentId), making state self-healing.
// Connectors and other frames are excluded from containment.
import type { BoardObject } from '../types/board';
import {
  getObjectCenter,
  RECT_MIN_SIZE,
  STICKY_MIN_HEIGHT,
  STICKY_MIN_WIDTH,
  TEXT_DEFAULT_FONT_SIZE,
  TEXT_MIN_HEIGHT,
  TEXT_MIN_WIDTH,
} from './board-object';

export interface FrameMembershipIndex {
  frameToChildren: Map<string, string[]>;
  childToFrame: Map<string, string>;
}

export interface FrameBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Returns true if the center of `child` falls within the axis-aligned
 * bounding box of `frame` (inclusive on all edges).
 */
export function isContainedInFrame(child: BoardObject, frame: BoardObject): boolean {
  const center = getObjectCenter(child);
  return (
    center.x >= frame.x &&
    center.x <= frame.x + frame.width &&
    center.y >= frame.y &&
    center.y <= frame.y + frame.height
  );
}

/**
 * Returns the IDs of all non-frame, non-connector objects whose center is
 * inside the given frame's bounds. Excludes the frame itself.
 */
export function getFrameChildren(
  frame: BoardObject,
  objectsMap: Map<string, BoardObject>,
): string[] {
  const children: string[] = [];
  for (const [id, obj] of objectsMap) {
    if (id === frame.id) continue;
    if (obj.type === 'frame' || obj.type === 'connector') continue;
    if (isContainedInFrame(obj, frame)) {
      children.push(id);
    }
  }
  return children;
}

/**
 * Builds a Map<frameId, childIds[]> for every frame in the objects map.
 * When an object falls inside two overlapping frames, it is assigned to the
 * smaller frame (by area) — "smallest-frame-wins".
 */
export function computeFrameMembership(
  objectsMap: Map<string, BoardObject>,
): Map<string, string[]> {
  return buildFrameMembershipIndex(objectsMap).frameToChildren;
}

/**
 * Builds deterministic frame membership indexes for runtime use:
 * - frameToChildren: Map<frameId, childIds[]>
 * - childToFrame: Map<childId, frameId>
 *
 * Assignment rule:
 * - only non-frame and non-connector objects are assignable
 * - containment is center-point in bounds
 * - overlapping frames use smallest-frame-wins
 */
export function buildFrameMembershipIndex(
  objectsMap: Map<string, BoardObject>,
): FrameMembershipIndex {
  // Collect all frames
  const frames: BoardObject[] = [];
  for (const obj of objectsMap.values()) {
    if (obj.type === 'frame') frames.push(obj);
  }

  const frameToChildren = new Map<string, string[]>();
  for (const frame of frames) {
    frameToChildren.set(frame.id, []);
  }

  if (frames.length === 0) {
    return {
      frameToChildren,
      childToFrame: new Map<string, string>(),
    };
  }

  // Sort frames by area ascending so we can assign to smallest first.
  // Tie-break by ID to keep deterministic assignment across clients.
  const sortedFrames = [...frames].sort(
    (a, b) => {
      const areaDelta = a.width * a.height - b.width * b.height;
      if (areaDelta !== 0) {
        return areaDelta;
      }
      return a.id.localeCompare(b.id);
    },
  );

  // Iterate objects in deterministic order so child list ordering is stable.
  const sortedObjects = Array.from(objectsMap.entries())
    .sort(([idA], [idB]) => idA.localeCompare(idB));

  // Track which objects have been assigned
  const assigned = new Set<string>();
  const childToFrame = new Map<string, string>();

  for (const frame of sortedFrames) {
    for (const [id, obj] of sortedObjects) {
      if (assigned.has(id)) continue;
      if (id === frame.id) continue;
      if (obj.type === 'frame' || obj.type === 'connector') continue;
      if (isContainedInFrame(obj, frame)) {
        frameToChildren.get(frame.id)!.push(id);
        childToFrame.set(id, frame.id);
        assigned.add(id);
      }
    }
  }

  return {
    frameToChildren,
    childToFrame,
  };
}

/**
 * Given a set of child IDs and a (dx, dy) delta, returns a new Map of
 * updated BoardObject entries with shifted x,y. Does NOT mutate input.
 */
export function applyFrameDelta(
  childIds: string[],
  dx: number,
  dy: number,
  objectsMap: Map<string, BoardObject>,
): Map<string, BoardObject> {
  const result = new Map<string, BoardObject>();
  for (const id of childIds) {
    const obj = objectsMap.get(id);
    if (!obj) continue;
    result.set(id, {
      ...obj,
      x: obj.x + dx,
      y: obj.y + dy,
    });
  }
  return result;
}

/**
 * Returns resized child objects after a frame resize operation.
 * Children are scaled/translated relative to the frame's top-left origin.
 * Does NOT mutate input.
 */
export function applyFrameResizeToChildren(
  childIds: string[],
  fromFrame: FrameBounds,
  toFrame: FrameBounds,
  objectsMap: Map<string, BoardObject>,
): Map<string, BoardObject> {
  const result = new Map<string, BoardObject>();
  const fromWidth = Math.max(1, fromFrame.width);
  const fromHeight = Math.max(1, fromFrame.height);
  const scaleX = Math.max(0.01, toFrame.width / fromWidth);
  const scaleY = Math.max(0.01, toFrame.height / fromHeight);
  const fontScale = Math.min(scaleX, scaleY);

  for (const id of childIds) {
    const obj = objectsMap.get(id);
    if (!obj) continue;
    if (obj.type === 'frame' || obj.type === 'connector') continue;

    const nextX = toFrame.x + (obj.x - fromFrame.x) * scaleX;
    const nextY = toFrame.y + (obj.y - fromFrame.y) * scaleY;
    const nextWidth = obj.width * scaleX;
    const nextHeight = obj.height * scaleY;

    const next: BoardObject = {
      ...obj,
      x: nextX,
      y: nextY,
      width:
        obj.type === 'sticky'
          ? Math.max(STICKY_MIN_WIDTH, nextWidth)
          : obj.type === 'text'
            ? Math.max(TEXT_MIN_WIDTH, nextWidth)
            : obj.type === 'rect' || obj.type === 'circle'
              ? Math.max(RECT_MIN_SIZE, nextWidth)
              : Math.max(1, nextWidth),
      height:
        obj.type === 'sticky'
          ? Math.max(STICKY_MIN_HEIGHT, nextHeight)
          : obj.type === 'text'
            ? Math.max(TEXT_MIN_HEIGHT, nextHeight)
            : obj.type === 'rect' || obj.type === 'circle'
              ? Math.max(RECT_MIN_SIZE, nextHeight)
              : Math.max(1, nextHeight),
      fontSize:
        obj.type === 'sticky' || obj.type === 'text'
          ? Math.max(10, (obj.fontSize || TEXT_DEFAULT_FONT_SIZE) * fontScale)
          : obj.fontSize,
      points:
        obj.type === 'line' && Array.isArray(obj.points)
          ? obj.points.map((value, index) => (index % 2 === 0 ? value * scaleX : value * scaleY))
          : obj.points,
    };

    result.set(id, next);
  }

  return result;
}

/**
 * Returns the frame ID (if any) that contains the given world-coordinate point.
 * If multiple frames overlap at the point, returns the smallest (by area).
 */
export function findFrameAtPoint(
  point: { x: number; y: number },
  objectsMap: Map<string, BoardObject>,
): string | null {
  let bestId: string | null = null;
  let bestArea = Infinity;

  for (const [id, obj] of objectsMap) {
    if (obj.type !== 'frame') continue;
    if (
      point.x >= obj.x &&
      point.x <= obj.x + obj.width &&
      point.y >= obj.y &&
      point.y <= obj.y + obj.height
    ) {
      const area = obj.width * obj.height;
      if (area < bestArea) {
        bestArea = area;
        bestId = id;
      }
    }
  }

  return bestId;
}
