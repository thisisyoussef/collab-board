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
 * Debounce a function by delay ms.
 * Returned function has a .flush() method to execute immediately if pending.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): ((...args: Parameters<T>) => void) & { flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latestArgs: Parameters<T> | null = null;
  const debounced = (...args: Parameters<T>) => {
    latestArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
      latestArgs = null;
    }, delay);
  };
  debounced.flush = () => {
    if (timer && latestArgs) {
      clearTimeout(timer);
      fn(...latestArgs);
      timer = null;
      latestArgs = null;
    }
  };
  return debounced;
}

/**
 * Generate a board-friendly UUID
 */
export function generateBoardId(): string {
  return crypto.randomUUID();
}

/**
 * Throttle a function to fire at most once per animation frame (16ms / 60fps).
 * Uses requestAnimationFrame for smooth cursor broadcasting.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttleRAF<T extends (...args: any[]) => void>(
  fn: T,
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  let latestArgs: Parameters<T> | null = null;
  return (...args: Parameters<T>) => {
    latestArgs = args;
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (latestArgs) fn(...latestArgs);
        rafId = null;
      });
    }
  };
}
