import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BoardRole, BoardVisibility, ShareRole } from '../types/sharing';
import { ShareSettingsPanel, type ShareMemberRow } from './ShareSettingsPanel';

interface RenderOverrides {
  canManage?: boolean;
  currentRole?: BoardRole;
  visibility?: BoardVisibility;
  authLinkRole?: ShareRole;
  publicLinkRole?: ShareRole;
  pendingPublicRole?: ShareRole | null;
  members?: ShareMemberRow[];
  canSaveToWorkspace?: boolean;
}

function renderPanel(overrides: RenderOverrides = {}) {
  const handlers = {
    onClose: vi.fn(),
    onCopyLink: vi.fn(),
    onVisibilityChange: vi.fn(),
    onAuthLinkRoleChange: vi.fn(),
    onPublicLinkRoleChange: vi.fn(),
    onSaveSettings: vi.fn(),
    onMemberRoleChange: vi.fn(),
    onMemberRemove: vi.fn(),
    onRefreshMembers: vi.fn(),
    onSaveToWorkspace: vi.fn(),
  };

  render(
    <ShareSettingsPanel
      open
      currentUserId="owner-1"
      currentRole={overrides.currentRole ?? 'owner'}
      canManage={overrides.canManage ?? true}
      visibility={overrides.visibility ?? 'private'}
      authLinkRole={overrides.authLinkRole ?? 'editor'}
      publicLinkRole={overrides.publicLinkRole ?? 'viewer'}
      pendingPublicRole={overrides.pendingPublicRole ?? null}
      settingsSaving={false}
      settingsError={null}
      settingsSuccess={null}
      members={overrides.members ?? []}
      membersLoading={false}
      membersError={null}
      workspaceState="idle"
      workspaceError={null}
      canSaveToWorkspace={overrides.canSaveToWorkspace ?? false}
      copyState="idle"
      {...handlers}
    />,
  );

  return handlers;
}

describe('ShareSettingsPanel', () => {
  it('requires explicit public role selection before saving when owner enables public link mode', () => {
    const handlers = renderPanel({
      visibility: 'public_link',
      pendingPublicRole: null,
    });

    const saveButton = screen.getByRole('button', { name: 'Save settings' });
    expect(saveButton).toBeDisabled();
    expect(screen.getByText('Choose public-link role before saving.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Public link role'), {
      target: { value: 'editor' },
    });
    expect(handlers.onPublicLinkRoleChange).toHaveBeenCalledWith('editor');
  });

  it('hides sharing controls for non-owners and shows save-to-workspace action', () => {
    const handlers = renderPanel({
      canManage: false,
      currentRole: 'viewer',
      canSaveToWorkspace: true,
    });

    expect(screen.queryByLabelText('Visibility mode')).not.toBeInTheDocument();
    expect(screen.getByText('Only owner can change sharing settings.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save to workspace' }));
    expect(handlers.onSaveToWorkspace).toHaveBeenCalledTimes(1);
  });

  it('supports member role updates and removals for owners', () => {
    const handlers = renderPanel({
      members: [
        { membershipId: 'board-1_user-2', userId: 'user-2', displayName: 'Sam Doe', role: 'viewer' },
        { membershipId: 'board-1_user-3', userId: 'user-3', displayName: 'Alex Doe', role: 'editor' },
      ],
    });

    expect(screen.getByText('Sam Doe')).toBeInTheDocument();
    expect(screen.getByText('Alex Doe')).toBeInTheDocument();
    expect(screen.queryByText('user-2')).not.toBeInTheDocument();
    expect(screen.queryByText('user-3')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Role for user-2'), {
      target: { value: 'editor' },
    });
    expect(handlers.onMemberRoleChange).toHaveBeenCalledWith('board-1_user-2', 'editor');

    fireEvent.click(screen.getByRole('button', { name: 'Remove user-3' }));
    expect(handlers.onMemberRemove).toHaveBeenCalledWith('board-1_user-3');
  });
});
