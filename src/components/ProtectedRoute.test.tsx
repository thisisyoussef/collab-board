import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { AuthContext, type AuthContextValue } from '../context/auth-context';
import { ProtectedRoute } from './ProtectedRoute';

function renderWithProviders(
  authValue: AuthContextValue,
  children: ReactNode,
  initialRoute = '/dashboard',
) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <ProtectedRoute>{children}</ProtectedRoute>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

const baseAuth: AuthContextValue = {
  user: null,
  loading: false,
  error: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
};

describe('ProtectedRoute', () => {
  it('shows loading state while auth is checking', () => {
    renderWithProviders({ ...baseAuth, loading: true }, <div>Protected Content</div>);

    expect(screen.getByText('Checking session...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to / when user is not authenticated', () => {
    renderWithProviders({ ...baseAuth, user: null }, <div>Protected Content</div>);

    // Content should not be visible (Navigate replaces the route)
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    const mockUser = { uid: 'user-123', displayName: 'Test' } as AuthContextValue['user'];

    renderWithProviders({ ...baseAuth, user: mockUser }, <div>Protected Content</div>);

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('does not show loading state when user is present', () => {
    const mockUser = { uid: 'user-123' } as AuthContextValue['user'];

    renderWithProviders(
      { ...baseAuth, user: mockUser, loading: false },
      <div>Dashboard</div>,
    );

    expect(screen.queryByText('Checking session...')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
