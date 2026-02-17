/**
 * Convert world coordinates to screen coordinates
 */
export function worldToScreen(
  point: { x: number; y: number },
  stagePos: { x: number; y: number },
  scale: number,
): { x: number; y: number } {
  return {
    x: point.x * scale + stagePos.x,
    y: point.y * scale + stagePos.y,
  };
}

/**
 * Convert screen coordinates to world coordinates
 */
export function screenToWorld(
  point: { x: number; y: number },
  stagePos: { x: number; y: number },
  scale: number,
): { x: number; y: number } {
  return {
    x: (point.x - stagePos.x) / scale,
    y: (point.y - stagePos.y) / scale,
  };
}

/**
 * Debounce a function by delay ms
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Generate a board-friendly UUID
 */
export function generateBoardId(): string {
  return crypto.randomUUID();
}
