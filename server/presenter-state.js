import { buildPresenceMember, normalizeNonEmptyString } from './presence.js';

function getRoomPresenterState(presentersByBoard, boardId) {
  const key = normalizeNonEmptyString(boardId);
  if (!key) {
    return null;
  }
  return presentersByBoard.get(key) || null;
}

function setRoomPresenterState(presentersByBoard, boardId, socket) {
  const key = normalizeNonEmptyString(boardId);
  if (!key) {
    return null;
  }

  const member = buildPresenceMember(socket);
  const presenter = {
    socketId: member.socketId,
    userId: member.userId,
    displayName: member.displayName,
    color: member.color,
  };

  presentersByBoard.set(key, presenter);
  return presenter;
}

function clearRoomPresenterState(presentersByBoard, boardId, socketId) {
  const key = normalizeNonEmptyString(boardId);
  if (!key) {
    return false;
  }

  const presenter = presentersByBoard.get(key);
  if (!presenter) {
    return false;
  }

  if (socketId && presenter.socketId !== socketId) {
    return false;
  }

  presentersByBoard.delete(key);
  return true;
}

export { getRoomPresenterState, setRoomPresenterState, clearRoomPresenterState };
