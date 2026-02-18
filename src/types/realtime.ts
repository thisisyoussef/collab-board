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
}

export interface ServerToClientEvents {
  'presence:snapshot': (members: PresenceMember[]) => void;
  'user:joined': (member: PresenceMember) => void;
  'user:left': (payload: UserLeftPayload) => void;
  'cursor:move': (payload: CursorMovePayload) => void;
  'cursor:hide': (payload: CursorHidePayload) => void;
  'server:error': (payload: ServerErrorPayload) => void;
}
