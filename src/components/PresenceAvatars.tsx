import { getInitials } from '../lib/utils';
import type { PresenceMember } from '../types/realtime';

interface PresenceMemberWithState extends PresenceMember {
  isLeaving?: boolean;
}

interface PresenceAvatarsProps {
  members: PresenceMemberWithState[];
  currentUserId: string | null;
}

const MAX_VISIBLE_AVATARS = 6;

export function PresenceAvatars({ members, currentUserId }: PresenceAvatarsProps) {
  if (members.length === 0) {
    return null;
  }

  const showOverflow = members.length > MAX_VISIBLE_AVATARS;
  const visibleMembers = showOverflow ? members.slice(0, MAX_VISIBLE_AVATARS - 1) : members;
  const overflowCount = members.length - visibleMembers.length;

  return (
    <div className="presence-cluster" aria-label={`${members.length} people on this board`}>
      <div className="presence-stack">
        {visibleMembers.map((member) => {
          const isCurrentUser = Boolean(currentUserId && member.userId === currentUserId);
          return (
            <span
              key={member.socketId}
              className={`avatar-badge presence-avatar ${isCurrentUser ? 'is-self' : ''} ${member.isLeaving ? 'is-leaving' : ''}`}
              style={{ background: member.color }}
              title={member.displayName}
              aria-label={member.displayName}
            >
              {getInitials(member.displayName)}
            </span>
          );
        })}

        {showOverflow ? (
          <span className="avatar-badge presence-avatar presence-overflow" aria-label={`${overflowCount} more people`}>
            +{overflowCount}
          </span>
        ) : null}
      </div>

      {members.length > 1 ? <span className="presence-count">{members.length} people</span> : null}
    </div>
  );
}
