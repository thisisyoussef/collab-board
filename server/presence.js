export function normalizeNonEmptyString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function boardRoom(boardId) {
  return `board:${boardId}`;
}

export function generateColor(userId) {
  const source = userId || 'guest';
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = source.charCodeAt(index) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

export function buildPresenceMember(socketLike) {
  const userId = socketLike?.data?.userId || 'unknown';
  const displayName = socketLike?.data?.displayName || 'Unknown';
  const color = socketLike?.data?.color || generateColor(userId);

  return {
    socketId: socketLike.id,
    userId,
    displayName,
    color,
  };
}

export function buildCursorPayload(rawPayload, socketLike) {
  const x = Number(rawPayload?.x);
  const y = Number(rawPayload?.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  const userId = socketLike?.data?.userId || 'unknown';
  const displayName = socketLike?.data?.displayName || 'Unknown';
  const color = socketLike?.data?.color || generateColor(userId);
  const ts = Number(rawPayload?._ts);

  return {
    socketId: socketLike.id,
    userId,
    displayName,
    color,
    x,
    y,
    _ts: Number.isFinite(ts) ? ts : Date.now(),
  };
}

export function buildCursorHidePayload(rawPayload, socketLike) {
  const userId = socketLike?.data?.userId || 'unknown';
  const ts = Number(rawPayload?._ts);

  return {
    socketId: socketLike.id,
    userId,
    _ts: Number.isFinite(ts) ? ts : Date.now(),
  };
}
