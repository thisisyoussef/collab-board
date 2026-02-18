const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

export interface ViewportState {
  x: number;
  y: number;
  scale: number;
}

export function viewportStorageKey({
  boardId,
  userId,
}: {
  boardId: string;
  userId: string | null;
}): string {
  return `collab-board:viewport:${boardId}:${userId || 'guest'}`;
}

export function clampViewportScale(scale: number): number {
  if (!Number.isFinite(scale)) {
    return 1;
  }
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

function isValidViewport(value: unknown): value is ViewportState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ViewportState>;
  return (
    Number.isFinite(candidate.x) &&
    Number.isFinite(candidate.y) &&
    Number.isFinite(candidate.scale)
  );
}

export function saveViewportState({
  boardId,
  userId,
  viewport,
}: {
  boardId: string;
  userId: string | null;
  viewport: ViewportState;
}) {
  if (typeof window === 'undefined' || !boardId) {
    return;
  }

  try {
    const payload = {
      x: Number(viewport.x),
      y: Number(viewport.y),
      scale: clampViewportScale(Number(viewport.scale)),
    };
    window.localStorage.setItem(viewportStorageKey({ boardId, userId }), JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
}

export function loadViewportState({
  boardId,
  userId,
}: {
  boardId: string;
  userId: string | null;
}): ViewportState | null {
  if (typeof window === 'undefined' || !boardId) {
    return null;
  }

  const raw = window.localStorage.getItem(viewportStorageKey({ boardId, userId }));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isValidViewport(parsed)) {
      return null;
    }

    return {
      x: Number(parsed.x),
      y: Number(parsed.y),
      scale: clampViewportScale(Number(parsed.scale)),
    };
  } catch {
    return null;
  }
}
