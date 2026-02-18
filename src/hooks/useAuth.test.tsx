import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { AuthContext, type AuthContextValue } from '../context/auth-context';
import { useAuth } from './useAuth';

function createWrapper(value: AuthContextValue) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  };
}

describe('useAuth', () => {
  it('returns the auth context value when wrapped in provider', () => {
    const mockValue: AuthContextValue = {
      user: null,
      loading: false,
      error: null,
      signInWithGoogle: async () => {},
      signOut: async () => {},
    };

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockValue),
    });

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.signInWithGoogle).toBeDefined();
    expect(result.current.signOut).toBeDefined();
  });

  it('throws when used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider.');
  });

  it('returns user when authenticated', () => {
    const mockUser = { uid: 'user-123', displayName: 'Test User' } as AuthContextValue['user'];
    const mockValue: AuthContextValue = {
      user: mockUser,
      loading: false,
      error: null,
      signInWithGoogle: async () => {},
      signOut: async () => {},
    };

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockValue),
    });

    expect(result.current.user).toBe(mockUser);
    expect(result.current.user?.uid).toBe('user-123');
  });

  it('returns loading true during auth transition', () => {
    const mockValue: AuthContextValue = {
      user: null,
      loading: true,
      error: null,
      signInWithGoogle: async () => {},
      signOut: async () => {},
    };

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockValue),
    });

    expect(result.current.loading).toBe(true);
  });

  it('returns error when auth fails', () => {
    const mockValue: AuthContextValue = {
      user: null,
      loading: false,
      error: 'Sign-in was cancelled.',
      signInWithGoogle: async () => {},
      signOut: async () => {},
    };

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockValue),
    });

    expect(result.current.error).toBe('Sign-in was cancelled.');
  });
});
