import type { PresenceMember } from '../types';

interface PresenceBarProps {
  members: PresenceMember[];
}

/**
 * DOM overlay showing online users (colored dots + names).
 * Positioned top-right of the viewport.
 */
export function PresenceBar({ members }: PresenceBarProps) {
  if (members.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        display: 'flex',
        gap: 6,
        background: '#fff',
        padding: '6px 10px',
        borderRadius: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 1000,
        alignItems: 'center',
      }}
    >
      {members.map((member) => (
        <div
          key={member.clientId}
          title={member.name}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: member.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {member.name.charAt(0).toUpperCase()}
        </div>
      ))}
      <span style={{ fontSize: 12, color: '#666', marginLeft: 4 }}>
        {members.length} online
      </span>
    </div>
  );
}
