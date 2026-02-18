export interface PresenceMember {
  socketId: string;
  userId: string;
  displayName: string;
  color: string;
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
}

export interface ServerToClientEvents {
  'presence:snapshot': (members: PresenceMember[]) => void;
  'user:joined': (member: PresenceMember) => void;
  'user:left': (payload: UserLeftPayload) => void;
  'server:error': (payload: ServerErrorPayload) => void;
}
