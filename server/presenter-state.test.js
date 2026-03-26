import { describe, expect, it } from 'vitest';
import {
  clearRoomPresenterState,
  getRoomPresenterState,
  setRoomPresenterState,
} from './presenter-state.js';

function buildSocket(overrides = {}) {
  return {
    id: overrides.id || 'socket-1',
    data: {
      userId: overrides.userId || 'user-1',
      displayName: overrides.displayName || 'Alex',
      color: overrides.color || 'hsl(10, 65%, 55%)',
    },
  };
}

describe('presenter-state helpers', () => {
  it('sets and gets room presenter state', () => {
    const presentersByBoard = new Map();
    const socket = buildSocket();

    const presenter = setRoomPresenterState(presentersByBoard, 'board-1', socket);
    expect(presenter).toMatchObject({
      socketId: 'socket-1',
      userId: 'user-1',
      displayName: 'Alex',
    });

    expect(getRoomPresenterState(presentersByBoard, 'board-1')).toEqual(presenter);
  });

  it('clears presenter only when socket matches active presenter', () => {
    const presentersByBoard = new Map();
    setRoomPresenterState(presentersByBoard, 'board-1', buildSocket({ id: 'socket-presenter' }));

    expect(clearRoomPresenterState(presentersByBoard, 'board-1', 'socket-other')).toBe(false);
    expect(getRoomPresenterState(presentersByBoard, 'board-1')).not.toBeNull();

    expect(clearRoomPresenterState(presentersByBoard, 'board-1', 'socket-presenter')).toBe(true);
    expect(getRoomPresenterState(presentersByBoard, 'board-1')).toBeNull();
  });
});
