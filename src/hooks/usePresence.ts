import type { User } from 'firebase/auth';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Socket } from 'socket.io-client';
import { getOrCreateGuestIdentity } from '../lib/guest';
import { generateColor } from '../lib/utils';
import type { SocketStatus } from './useSocket';
import type {
  ClientToServerEvents,
  JoinBoardPayload,
  PresenceMember,
  ServerToClientEvents,
  UserLeftPayload,
} from '../types/realtime';

const LEAVE_ANIMATION_MS = 160;

interface PresenceMemberWithState extends PresenceMember {
  isLeaving?: boolean;
}

interface UsePresenceParams {
  boardId: string | undefined;
  user: User | null;
  socketRef: MutableRefObject<Socket<ServerToClientEvents, ClientToServerEvents> | null>;
  socketStatus: SocketStatus;
}

function normalizeMember(member: PresenceMember): PresenceMemberWithState | null {
  const socketId = member.socketId?.trim();
  if (!socketId) {
    return null;
  }

  const userId = member.userId?.trim() || 'unknown';
  return {
    socketId,
    userId,
    displayName: member.displayName?.trim() || 'Unknown',
    color: member.color?.trim() || generateColor(userId),
    isLeaving: false,
  };
}

function sortMembers(items: PresenceMemberWithState[]): PresenceMemberWithState[] {
  return [...items].sort((a, b) => {
    const byName = a.displayName.localeCompare(b.displayName);
    if (byName !== 0) {
      return byName;
    }
    return a.socketId.localeCompare(b.socketId);
  });
}

export function usePresence({ boardId, user, socketRef, socketStatus }: UsePresenceParams) {
  const [members, setMembers] = useState<PresenceMemberWithState[]>([]);
  const leaveTimersRef = useRef<Record<string, number>>({});
  const guestIdentity = useMemo(() => getOrCreateGuestIdentity(), []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !boardId || socketStatus !== 'connected') {
      return;
    }

    const leaveTimers = leaveTimersRef.current;

    const selfDisplayName = user?.displayName || user?.email || guestIdentity.displayName;
    const selfId = user?.uid || guestIdentity.userId;
    const joinPayload: JoinBoardPayload = {
      boardId,
      user: {
        id: selfId,
        displayName: selfDisplayName,
        color: generateColor(selfId),
      },
    };

    const clearLeaveTimer = (socketId: string) => {
      const timer = leaveTimers[socketId];
      if (timer) {
        window.clearTimeout(timer);
        delete leaveTimers[socketId];
      }
    };

    const handleSnapshot = (snapshot: PresenceMember[]) => {
      Object.keys(leaveTimers).forEach((socketId) => {
        clearLeaveTimer(socketId);
      });

      const nextBySocketId = new Map<string, PresenceMemberWithState>();
      snapshot.forEach((entry) => {
        const normalized = normalizeMember(entry);
        if (normalized) {
          nextBySocketId.set(normalized.socketId, normalized);
        }
      });

      setMembers(sortMembers(Array.from(nextBySocketId.values())));
    };

    const handleJoined = (member: PresenceMember) => {
      const normalized = normalizeMember(member);
      if (!normalized) {
        return;
      }

      clearLeaveTimer(normalized.socketId);
      setMembers((previous) => {
        const next = previous.filter((entry) => entry.socketId !== normalized.socketId);
        next.push(normalized);
        return sortMembers(next);
      });
    };

    const handleLeft = (payload: UserLeftPayload) => {
      const socketId = payload.socketId?.trim();
      if (!socketId) {
        return;
      }

      setMembers((previous) =>
        previous.map((entry) =>
          entry.socketId === socketId ? { ...entry, isLeaving: true } : entry,
        ),
      );

      clearLeaveTimer(socketId);
      leaveTimers[socketId] = window.setTimeout(() => {
        setMembers((previous) => previous.filter((entry) => entry.socketId !== socketId));
        delete leaveTimers[socketId];
      }, LEAVE_ANIMATION_MS);
    };

    socket.on('presence:snapshot', handleSnapshot);
    socket.on('user:joined', handleJoined);
    socket.on('user:left', handleLeft);
    socket.emit('join-board', joinPayload);

    return () => {
      socket.off('presence:snapshot', handleSnapshot);
      socket.off('user:joined', handleJoined);
      socket.off('user:left', handleLeft);

      Object.keys(leaveTimers).forEach((socketId) => {
        clearLeaveTimer(socketId);
      });
    };
  }, [boardId, guestIdentity.displayName, guestIdentity.userId, socketRef, socketStatus, user]);

  return {
    members: boardId && socketStatus === 'connected' ? members : [],
  };
}
