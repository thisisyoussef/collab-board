import type { BoardObject } from '../types/board';

export const CLIPBOARD_STORAGE_KEY = 'collab-board-clipboard';

interface BoardClipboardPayload {
  version: 1;
  objects: BoardObject[];
  copiedAt: number;
}

/**
 * Clone an array of board objects with new IDs and offset positions.
 * Preserves all attributes including type-specific ones.
 * Preserves relative positions between objects.
 */
export function cloneObjects(
  objects: BoardObject[],
  offset: { dx: number; dy: number },
): BoardObject[] {
  const now = new Date().toISOString();

  return objects.map((obj) => ({
    ...obj,
    id: crypto.randomUUID(),
    x: obj.x + offset.dx,
    y: obj.y + offset.dy,
    updatedAt: now,
  }));
}

/**
 * Re-link connectors in the cloned set so they point to cloned endpoints
 * instead of originals. If a connector's endpoint is NOT in the selection,
 * clear that reference (set to '').
 *
 * Mutates clones in-place for efficiency.
 */
export function relinkConnectors(
  originals: BoardObject[],
  clones: BoardObject[],
): void {
  // Build a mapping from original ID -> cloned ID
  const idMap = new Map<string, string>();
  for (let i = 0; i < originals.length; i++) {
    idMap.set(originals[i].id, clones[i].id);
  }

  // Re-link connectors
  for (const clone of clones) {
    if (clone.type !== 'connector') continue;

    if (clone.fromId) {
      const mappedFrom = idMap.get(clone.fromId);
      clone.fromId = mappedFrom ?? '';
    }

    if (clone.toId) {
      const mappedTo = idMap.get(clone.toId);
      clone.toId = mappedTo ?? '';
    }
  }
}

/**
 * Serialize board objects to sessionStorage clipboard.
 */
export function serializeToClipboard(objects: BoardObject[]): void {
  const payload: BoardClipboardPayload = {
    version: 1,
    objects,
    copiedAt: Date.now(),
  };

  try {
    sessionStorage.setItem(CLIPBOARD_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage may be unavailable or full — silently fail
  }
}

/**
 * Deserialize board objects from sessionStorage clipboard.
 * Returns null if clipboard is empty, invalid, or has wrong version.
 */
export function deserializeFromClipboard(): BoardObject[] | null {
  try {
    const raw = sessionStorage.getItem(CLIPBOARD_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<BoardClipboardPayload>;

    if (parsed.version !== 1) return null;
    if (!Array.isArray(parsed.objects)) return null;
    if (parsed.objects.length === 0) return null;

    return parsed.objects;
  } catch {
    return null;
  }
}
