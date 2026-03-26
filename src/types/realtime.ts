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
  txId?: string;
  source?: 'user' | 'ai';
  actorUserId?: string;
}

export interface PresenterState {
  socketId: string;
  userId: string;
  displayName: string;
  color: string;
}

export interface PresenterStatePayload {
  boardId: string;
  presenter: PresenterState | null;
  _ts: number;
}

export interface PresenterViewportPayload {
  boardId: string;
  presenterUserId: string;
  x: number;
  y: number;
  scale: number;
  _ts: number;
}

export interface RealtimeObjectEventMeta {
  txId?: string;
  source?: 'user' | 'ai';
  actorUserId?: string;
}

export interface ObjectCreatePayload extends RealtimeObjectEventMeta {
  boardId: string;
  object: BoardObject;
  _ts: number;
}

export interface ObjectUpdatePayload extends RealtimeObjectEventMeta {
  boardId: string;
  object: BoardObject;
  _ts: number;
}

export interface ObjectDeletePayload extends RealtimeObjectEventMeta {
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
  'presenter:start': (payload: { boardId: string }) => void;
  'presenter:stop': (payload: { boardId: string }) => void;
  'presenter:viewport': (payload: PresenterViewportPayload) => void;
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
  'presenter:state': (payload: PresenterStatePayload) => void;
  'presenter:viewport': (payload: PresenterViewportPayload) => void;
  'server:error': (payload: ServerErrorPayload) => void;
}
