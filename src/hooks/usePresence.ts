import { useEffect, useState, useRef } from 'react';
import { getBoardChannel } from '../lib/ably';
import type { PresenceMember } from '../types';

/**
 * Ably presence hook — tracks who's online on a board.
 * Per ably-firestore-sync skill: enter with { name, color }, subscribe to enter/leave/update.
 */
export function usePresence(
  boardId: string,
  userName: string,
  userColor: string,
  onMemberLeave?: (clientId: string) => void,
): PresenceMember[] {
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const onMemberLeaveRef = useRef(onMemberLeave);
  onMemberLeaveRef.current = onMemberLeave;

  useEffect(() => {
    const channel = getBoardChannel(boardId);
    const presence = channel.presence;

    // Enter presence with our data
    presence.enter({ name: userName, color: userColor });

    const syncMembers = async () => {
      try {
        const presenceMessages = await presence.get();
        const mapped: PresenceMember[] = presenceMessages.map((msg) => ({
          clientId: msg.clientId ?? '',
          name: (msg.data as { name?: string })?.name ?? 'Anonymous',
          color: (msg.data as { color?: string })?.color ?? '#999',
        }));
        setMembers(mapped);
      } catch {
        // Presence sync failed — retry on next event
      }
    };

    const onEnter = () => syncMembers();
    const onLeave = (msg: { clientId?: string | null }) => {
      if (msg.clientId) {
        onMemberLeaveRef.current?.(msg.clientId);
      }
      syncMembers();
    };
    const onUpdate = () => syncMembers();

    presence.subscribe('enter', onEnter);
    presence.subscribe('leave', onLeave);
    presence.subscribe('update', onUpdate);

    // Initial sync
    syncMembers();

    return () => {
      presence.unsubscribe('enter', onEnter);
      presence.unsubscribe('leave', onLeave);
      presence.unsubscribe('update', onUpdate);
      presence.leave();
    };
  }, [boardId, userName, userColor]);

  return members;
}
