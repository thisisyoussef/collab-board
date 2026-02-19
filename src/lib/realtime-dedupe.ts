import { logger } from './logger';

export type RealtimeEventType = 'object:create' | 'object:update' | 'object:delete';

export interface RealtimeEventSignatureInput {
  eventType: RealtimeEventType;
  boardId?: string;
  objectId?: string;
  txId?: string;
  actorUserId?: string;
  source?: 'user' | 'ai';
  ts?: number;
}

export interface RealtimeDedupeCacheOptions {
  ttlMs?: number;
  maxEntries?: number;
  nowMs?: () => number;
}

export interface RealtimeDedupeCache {
  markIfNew: (signature: string) => boolean;
  clear: () => void;
  size: () => number;
}

const DEFAULT_TTL_MS = 30_000;
const DEFAULT_MAX_ENTRIES = 4_000;

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildRealtimeEventSignature({
  eventType,
  boardId,
  objectId,
  txId,
  actorUserId,
  source,
  ts,
}: RealtimeEventSignatureInput): string | null {
  const normalizedBoardId = normalizeString(boardId);
  const normalizedObjectId = normalizeString(objectId);
  const normalizedTxId = normalizeString(txId);
  const normalizedActorUserId = normalizeString(actorUserId);
  const normalizedSource = source === 'ai' || source === 'user' ? source : '';
  const normalizedTs = Number.isFinite(ts) ? String(Number(ts)) : '';

  if (!eventType || !normalizedBoardId || !normalizedObjectId || !normalizedTs) {
    return null;
  }

  return [
    eventType,
    normalizedBoardId,
    normalizedObjectId,
    normalizedTxId || '-',
    normalizedSource || '-',
    normalizedActorUserId || '-',
    normalizedTs,
  ].join(':');
}

export function createRealtimeDedupeCache({
  ttlMs = DEFAULT_TTL_MS,
  maxEntries = DEFAULT_MAX_ENTRIES,
  nowMs = () => Date.now(),
}: RealtimeDedupeCacheOptions = {}): RealtimeDedupeCache {
  const cache = new Map<string, number>();

  const pruneExpired = (now: number) => {
    for (const [key, expiresAt] of cache.entries()) {
      if (expiresAt <= now) {
        cache.delete(key);
      }
    }
  };

  const pruneOverflow = () => {
    if (cache.size <= maxEntries) {
      return;
    }

    const overflowCount = cache.size - maxEntries;
    logger.warn('SYNC', `Dedupe cache overflow: pruning ${overflowCount} oldest entries (cache: ${cache.size}/${maxEntries})`, {
      overflowCount,
      cacheSize: cache.size,
      maxEntries,
    });
    const keys = cache.keys();
    for (let index = 0; index < overflowCount; index += 1) {
      const next = keys.next();
      if (next.done) {
        return;
      }
      cache.delete(next.value);
    }
  };

  return {
    markIfNew(signature: string): boolean {
      const normalizedSignature = normalizeString(signature);
      if (!normalizedSignature) {
        return true;
      }

      const now = nowMs();
      pruneExpired(now);

      if (cache.has(normalizedSignature)) {
        return false;
      }

      cache.set(normalizedSignature, now + ttlMs);
      pruneOverflow();
      return true;
    },
    clear() {
      cache.clear();
    },
    size() {
      return cache.size;
    },
  };
}
