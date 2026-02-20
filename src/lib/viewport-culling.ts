// Pure viewport culling: given a list of objects and the current stage transform,
// return only objects whose bounding box intersects the visible viewport.
// This is the CLAUDE.md-recommended pattern for scaling to 500+ objects.

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Filter objects to only those visible within the current viewport.
 *
 * @param objects   Array of objects with x/y/width/height
 * @param stagePos  Konva Stage position (negative when panned)
 * @param scale     Current zoom scale (Stage.scaleX)
 * @param viewportSize  Browser viewport dimensions in pixels
 * @returns Subset of objects whose bounding box overlaps the viewport
 */
export function getVisibleObjects<T extends Bounds>(
  objects: T[],
  stagePos: { x: number; y: number },
  scale: number,
  viewportSize: { width: number; height: number },
): T[] {
  if (objects.length === 0 || scale <= 0) {
    return [];
  }

  // Convert viewport bounds from screen space to world space.
  // Stage position is the *pixel offset* of the origin in screen space,
  // so the world-space top-left is (-stagePos / scale).
  const viewBounds: Bounds = {
    x: -stagePos.x / scale,
    y: -stagePos.y / scale,
    width: viewportSize.width / scale,
    height: viewportSize.height / scale,
  };

  return objects.filter((obj) => aabbOverlap(obj, viewBounds));
}

/** Axis-aligned bounding box overlap test. */
function aabbOverlap(a: Bounds, b: Bounds): boolean {
  return (
    a.x + a.width > b.x &&
    a.x < b.x + b.width &&
    a.y + a.height > b.y &&
    a.y < b.y + b.height
  );
}
