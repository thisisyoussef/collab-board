import type { BoardRole, BoardVisibility, ShareRole } from '../types/sharing';

export interface ShareMemberRow {
  membershipId: string;
  userId: string;
  role: Exclude<BoardRole, 'none'>;
  displayName?: string;
}

interface ShareSettingsPanelProps {
  open: boolean;
  currentUserId?: string | null;
  currentRole: BoardRole;
  canManage: boolean;
  visibility: BoardVisibility;
  authLinkRole: ShareRole;
  publicLinkRole: ShareRole;
  pendingPublicRole: ShareRole | null;
  settingsSaving: boolean;
  settingsError: string | null;
  settingsSuccess: string | null;
  members: ShareMemberRow[];
  membersLoading: boolean;
  membersError: string | null;
  workspaceState: 'idle' | 'saving' | 'saved' | 'error';
  workspaceError: string | null;
  canSaveToWorkspace: boolean;
  copyState: 'idle' | 'copied' | 'error';
  onClose: () => void;
  onCopyLink: () => void;
  onVisibilityChange: (value: BoardVisibility) => void;
  onAuthLinkRoleChange: (value: ShareRole) => void;
  onPublicLinkRoleChange: (value: ShareRole) => void;
  onSaveSettings: () => void;
  onMemberRoleChange: (membershipId: string, role: ShareRole) => void;
  onMemberRemove: (membershipId: string) => void;
  onRefreshMembers: () => void;
  onSaveToWorkspace: () => void;
}

export function ShareSettingsPanel({
  open,
  currentUserId,
  currentRole,
  canManage,
  visibility,
  authLinkRole,
  publicLinkRole,
  pendingPublicRole,
  settingsSaving,
  settingsError,
  settingsSuccess,
  members,
  membersLoading,
  membersError,
  workspaceState,
  workspaceError,
  canSaveToWorkspace,
  copyState,
  onClose,
  onCopyLink,
  onVisibilityChange,
  onAuthLinkRoleChange,
  onPublicLinkRoleChange,
  onSaveSettings,
  onMemberRoleChange,
  onMemberRemove,
  onRefreshMembers,
  onSaveToWorkspace,
}: ShareSettingsPanelProps) {
  if (!open) {
    return null;
  }

  const requiresPublicRoleSelection = visibility === 'public_link' && pendingPublicRole === null;
  const saveSettingsDisabled = settingsSaving || requiresPublicRoleSelection;

  return (
    <div className="share-panel-overlay" role="presentation" onClick={onClose}>
      <aside
        className="share-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Share board"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="share-panel-head">
          <div className="share-panel-head-copy">
            <p className="share-panel-kicker" data-testid="share-panel-kicker">
              Access control
            </p>
            <h3>Share board</h3>
            <p className="share-panel-muted">Manage visibility and collaborator roles.</p>
          </div>
          <button className="secondary-btn" type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <section className="share-panel-section">
          <h4>Link</h4>
          <div className="share-link-row">
            <button className="secondary-btn" type="button" onClick={onCopyLink}>
              {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy link'}
            </button>
            <span className="share-current-role">
              <span className="share-panel-muted">Current role</span>
              <span className="share-current-role-badge" data-testid="share-current-role-badge">
                {currentRole}
              </span>
            </span>
          </div>
        </section>

        {canManage ? (
          <>
            <section className="share-panel-section">
              <h4>Sharing settings</h4>
              <label className="share-field">
                <span>Visibility mode</span>
                <select
                  aria-label="Visibility mode"
                  value={visibility}
                  onChange={(event) => onVisibilityChange(event.target.value as BoardVisibility)}
                >
                  <option value="private">Private</option>
                  <option value="auth_link">Auth link</option>
                  <option value="public_link">Public link</option>
                </select>
              </label>

              <label className="share-field">
                <span>Auth link role</span>
                <select
                  aria-label="Auth link role"
                  value={authLinkRole}
                  onChange={(event) => onAuthLinkRoleChange(event.target.value as ShareRole)}
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>
              <p className="share-panel-muted">Current public-link role: {publicLinkRole}</p>

              {visibility === 'public_link' ? (
                <label className="share-field">
                  <span>Public link role</span>
                  <select
                    aria-label="Public link role"
                    value={pendingPublicRole ?? ''}
                    onChange={(event) => onPublicLinkRoleChange(event.target.value as ShareRole)}
                  >
                    <option value="" disabled>
                      Select role
                    </option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </label>
              ) : null}

              {requiresPublicRoleSelection ? (
                <p className="share-panel-error">Choose public-link role before saving.</p>
              ) : null}
              {settingsError ? <p className="share-panel-error">{settingsError}</p> : null}
              {settingsSuccess ? <p className="share-panel-success">{settingsSuccess}</p> : null}

              <button
                className="primary-btn"
                type="button"
                onClick={onSaveSettings}
                disabled={saveSettingsDisabled}
              >
                {settingsSaving ? 'Saving...' : 'Save settings'}
              </button>
            </section>

            <section className="share-panel-section">
              <div className="share-panel-row">
                <h4>Members</h4>
                <button className="secondary-btn" type="button" onClick={onRefreshMembers}>
                  Refresh
                </button>
              </div>
              {membersError ? <p className="share-panel-error">{membersError}</p> : null}
              {membersLoading ? (
                <p className="share-panel-muted">Loading members...</p>
              ) : members.length === 0 ? (
                <p className="share-panel-muted">No explicit members yet.</p>
              ) : (
                <ul className="share-member-list">
                  {members.map((member) => (
                    <li key={member.membershipId} className="share-member-row">
                      <div className="share-member-meta">
                        <span className="share-member-id">
                          {member.displayName || 'Member'}
                          {currentUserId && member.userId === currentUserId ? ' (you)' : ''}
                        </span>
                      </div>

                      <div className="share-member-actions">
                        {member.role === 'owner' ? (
                          <span className="share-member-owner">Owner</span>
                        ) : (
                          <>
                            <select
                              aria-label={`Role for ${member.userId}`}
                              value={member.role}
                              onChange={(event) =>
                                onMemberRoleChange(member.membershipId, event.target.value as ShareRole)
                              }
                            >
                              <option value="editor">Editor</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <button
                              className="danger-btn"
                              type="button"
                              aria-label={`Remove ${member.userId}`}
                              onClick={() => onMemberRemove(member.membershipId)}
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <section className="share-panel-section">
            <h4>Sharing settings</h4>
            <p className="share-panel-muted">Only owner can change sharing settings.</p>
            {canSaveToWorkspace ? (
              <div className="share-panel-save-workspace">
                <button
                  className="primary-btn"
                  type="button"
                  onClick={onSaveToWorkspace}
                  disabled={workspaceState === 'saving' || workspaceState === 'saved'}
                >
                  {workspaceState === 'saving'
                    ? 'Saving...'
                    : workspaceState === 'saved'
                      ? 'Saved'
                      : 'Save to workspace'}
                </button>
                {workspaceError ? <p className="share-panel-error">{workspaceError}</p> : null}
              </div>
            ) : null}
          </section>
        )}
      </aside>
    </div>
  );
}
