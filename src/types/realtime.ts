import type { BoardObject } from './board';

export interface PresenceMember {
  socketId: string;
  userId: string;
  displayName: string;
  color: string;
}

export interface CursorData {
  x: number;
  y: number;
  userId: string;
  displayName: string;
  color: string;
  _ts: number;
}

export interface CursorMovePayload extends CursorData {
  socketId: string;
}

export interface CursorHidePayload {
  socketId: string;
  userId: string;
  _ts: number;
}

export interface BoardChangedPayload {
  boardId: string;
  _ts: number;
}

export interface ObjectCreatePayload {
  boardId: string;
  object: BoardObject;
  _ts: number;
}

export interface ObjectUpdatePayload {
  boardId: string;
  object: BoardObject;
  _ts: number;
}

export interface ObjectDeletePayload {
  boardId: string;
  objectId: string;
  _ts: number;
}

export interface JoinBoardPayload {
  boardId: string;
  user: {
    id: string;
    displayName: string;
    color: string;
  };
}

export interface UserLeftPayload {
  socketId: string;
  userId: string;
}

export interface ServerErrorPayload {
  code?: string;
  message: string;
}

export interface ClientToServerEvents {
  'join-board': (payload: JoinBoardPayload) => void;
  'cursor:move': (payload: CursorData) => void;
  'cursor:hide': (payload?: { _ts?: number }) => void;
  'board:changed': (payload: BoardChangedPayload) => void;
  'object:create': (payload: ObjectCreatePayload) => void;
  'object:update': (payload: ObjectUpdatePayload) => void;
  'object:delete': (payload: ObjectDeletePayload) => void;
}

export interface ServerToClientEvents {
  'presence:snapshot': (members: PresenceMember[]) => void;
  'user:joined': (member: PresenceMember) => void;
  'user:left': (payload: UserLeftPayload) => void;
  'cursor:move': (payload: CursorMovePayload) => void;
  'cursor:hide': (payload: CursorHidePayload) => void;
  'board:changed': (payload: BoardChangedPayload) => void;
  'object:create': (payload: ObjectCreatePayload) => void;
  'object:update': (payload: ObjectUpdatePayload) => void;
  'object:delete': (payload: ObjectDeletePayload) => void;
  'server:error': (payload: ServerErrorPayload) => void;
}
