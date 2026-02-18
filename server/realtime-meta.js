import { normalizeNonEmptyString } from './presence.js';

export function extractRealtimeMeta(payload, socketUserId) {
  const txId = normalizeNonEmptyString(payload?.txId);
  const source = normalizeNonEmptyString(payload?.source);
  const actorUserId =
    normalizeNonEmptyString(payload?.actorUserId) || normalizeNonEmptyString(socketUserId);

  return {
    ...(txId ? { txId } : {}),
    ...(source === 'ai' || source === 'user' ? { source } : {}),
    ...(actorUserId ? { actorUserId } : {}),
  };
}
