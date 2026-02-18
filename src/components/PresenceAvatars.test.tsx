import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PresenceAvatars } from './PresenceAvatars';

const baseMembers = [
  { socketId: 's1', userId: 'u1', displayName: 'Alex Johnson', color: 'hsl(10, 65%, 55%)' },
  { socketId: 's2', userId: 'u2', displayName: 'Sam Doe', color: 'hsl(80, 65%, 55%)' },
  { socketId: 's3', userId: 'u3', displayName: 'Jordan Lee', color: 'hsl(120, 65%, 55%)' },
];

describe('PresenceAvatars', () => {
  it('renders a single avatar without people count', () => {
    render(<PresenceAvatars members={[baseMembers[0]]} currentUserId="u1" />);

    expect(screen.getByLabelText('Alex Johnson')).toBeInTheDocument();
    expect(screen.queryByText('1 people')).not.toBeInTheDocument();
  });

  it('renders count label for multiple users', () => {
    render(<PresenceAvatars members={baseMembers} currentUserId="u1" />);

    expect(screen.getByText('3 people')).toBeInTheDocument();
    const selfAvatar = screen.getByLabelText('Alex Johnson');
    expect(selfAvatar.className).toContain('is-self');
  });

  it('renders overflow avatar when there are more than six members', () => {
    const manyMembers = Array.from({ length: 8 }, (_, index) => ({
      socketId: `socket-${index}`,
      userId: `user-${index}`,
      displayName: `Member ${index}`,
      color: `hsl(${index * 30}, 65%, 55%)`,
    }));

    render(<PresenceAvatars members={manyMembers} currentUserId="user-0" />);

    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByText('8 people')).toBeInTheDocument();
  });
});
