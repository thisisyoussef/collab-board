import { describe, expect, it } from 'vitest';
import {
  normalizeBoardRole,
  normalizeBoardSharingConfig,
  resolveBoardAccess,
  shouldRedirectToSignIn,
} from './access';

describe('access', () => {
  it('normalizes board role values safely', () => {
    expect(normalizeBoardRole('owner')).toBe('owner');
    expect(normalizeBoardRole('editor')).toBe('editor');
    expect(normalizeBoardRole('viewer')).toBe('viewer');
    expect(normalizeBoardRole('none')).toBeNull();
    expect(normalizeBoardRole('')).toBeNull();
    expect(normalizeBoardRole(undefined)).toBeNull();
  });

  it('falls back legacy sharing defaults when sharing is missing', () => {
    expect(normalizeBoardSharingConfig(null)).toEqual({
      visibility: 'auth_link',
      authLinkRole: 'editor',
      publicLinkRole: 'viewer',
      isLegacyFallback: true,
    });
  });

  it('owner always has full permissions', () => {
    const access = resolveBoardAccess({
      ownerId: 'owner-1',
      userId: 'owner-1',
      isAuthenticated: true,
      explicitMemberRole: 'viewer',
      sharing: { visibility: 'private' },
    });

    expect(access.effectiveRole).toBe('owner');
    expect(access.canRead).toBe(true);
    expect(access.canEdit).toBe(true);
    expect(access.canApplyAI).toBe(true);
  });

  it('private board denies non-members', () => {
    const access = resolveBoardAccess({
      ownerId: 'owner-1',
      userId: 'user-2',
      isAuthenticated: true,
      sharing: { visibility: 'private' },
    });

    expect(access.effectiveRole).toBe('none');
    expect(access.canRead).toBe(false);
    expect(access.canEdit).toBe(false);
    expect(access.canApplyAI).toBe(false);
  });

  it('auth_link grants signed-in users default editor role', () => {
    const access = resolveBoardAccess({
      ownerId: 'owner-1',
      userId: 'user-2',
      isAuthenticated: true,
      sharing: { visibility: 'auth_link' },
    });

    expect(access.effectiveRole).toBe('editor');
    expect(access.canRead).toBe(true);
    expect(access.canEdit).toBe(true);
    expect(access.canApplyAI).toBe(true);
  });

  it('auth_link denies anonymous users', () => {
    const access = resolveBoardAccess({
      ownerId: 'owner-1',
      userId: null,
      isAuthenticated: false,
      sharing: { visibility: 'auth_link', authLinkRole: 'viewer' },
    });

    expect(access.effectiveRole).toBe('none');
    expect(access.canRead).toBe(false);
    expect(access.canEdit).toBe(false);
    expect(access.canApplyAI).toBe(false);
  });

  it('public_link grants anonymous users configured role without AI apply', () => {
    const access = resolveBoardAccess({
      ownerId: 'owner-1',
      userId: null,
      isAuthenticated: false,
      sharing: { visibility: 'public_link', publicLinkRole: 'editor' },
    });

    expect(access.effectiveRole).toBe('editor');
    expect(access.canRead).toBe(true);
    expect(access.canEdit).toBe(true);
    expect(access.canApplyAI).toBe(false);
  });

  it('explicit member role overrides link defaults', () => {
    const access = resolveBoardAccess({
      ownerId: 'owner-1',
      userId: 'user-2',
      isAuthenticated: true,
      explicitMemberRole: 'viewer',
      sharing: {
        visibility: 'public_link',
        publicLinkRole: 'editor',
      },
    });

    expect(access.effectiveRole).toBe('viewer');
    expect(access.canRead).toBe(true);
    expect(access.canEdit).toBe(false);
    expect(access.canApplyAI).toBe(false);
  });

  it('legacy fallback keeps signed-in users editable and anonymous users blocked', () => {
    const signedIn = resolveBoardAccess({
      ownerId: 'owner-1',
      userId: 'user-2',
      isAuthenticated: true,
      sharing: null,
    });
    const anonymous = resolveBoardAccess({
      ownerId: 'owner-1',
      userId: null,
      isAuthenticated: false,
      sharing: null,
    });

    expect(signedIn.isLegacyFallback).toBe(true);
    expect(signedIn.effectiveRole).toBe('editor');
    expect(signedIn.canEdit).toBe(true);

    expect(anonymous.isLegacyFallback).toBe(true);
    expect(anonymous.effectiveRole).toBe('none');
    expect(anonymous.canRead).toBe(false);
  });

  it('redirect helper only redirects anonymous users who cannot read', () => {
    const blockedAnonymous = resolveBoardAccess({
      ownerId: 'owner-1',
      isAuthenticated: false,
      sharing: { visibility: 'private' },
    });
    const publicAnonymous = resolveBoardAccess({
      ownerId: 'owner-1',
      isAuthenticated: false,
      sharing: { visibility: 'public_link', publicLinkRole: 'viewer' },
    });
    const signedInBlocked = resolveBoardAccess({
      ownerId: 'owner-1',
      userId: 'user-2',
      isAuthenticated: true,
      sharing: { visibility: 'private' },
    });

    expect(shouldRedirectToSignIn(blockedAnonymous, false)).toBe(true);
    expect(shouldRedirectToSignIn(publicAnonymous, false)).toBe(false);
    expect(shouldRedirectToSignIn(signedInBlocked, true)).toBe(false);
  });
});
