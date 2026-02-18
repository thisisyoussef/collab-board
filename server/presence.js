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
