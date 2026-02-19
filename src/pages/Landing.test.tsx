import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../context/auth-context';
import { Landing } from './Landing';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const baseAuth: AuthContextValue = {
  user: null,
  loading: false,
  error: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
};

function renderLanding(authOverrides: Partial<AuthContextValue> = {}) {
  return renderLandingAt('/', authOverrides);
}

function renderLandingAt(path: string, authOverrides: Partial<AuthContextValue> = {}) {
  const authValue = { ...baseAuth, ...authOverrides };
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[path]}>
        <Landing />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('Landing', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    window.sessionStorage.clear();
  });

  it('renders the sign-in button when not authenticated', () => {
    renderLanding();

    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
  });

  it('renders the CollabBoard brand', () => {
    renderLanding();

    expect(screen.getByText('CollabBoard')).toBeInTheDocument();
  });

  it('shows loading state while auth is checking', () => {
    renderLanding({ loading: true });

    expect(screen.getByText('Loading auth...')).toBeInTheDocument();
    expect(screen.queryByText('Sign in with Google')).not.toBeInTheDocument();
  });

  it('redirects to /dashboard when user is already signed in', () => {
    const mockUser = { uid: 'u1', displayName: 'Test' } as AuthContextValue['user'];
    renderLanding({ user: mockUser });

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('redirects to returnTo path when signed in and returnTo is valid', () => {
    const mockUser = { uid: 'u1', displayName: 'Test' } as AuthContextValue['user'];
    renderLandingAt('/?returnTo=%2Fboard%2Fabc123', { user: mockUser });

    expect(mockNavigate).toHaveBeenCalledWith('/board/abc123', { replace: true });
  });

  it('ignores unsafe returnTo and falls back to dashboard', () => {
    const mockUser = { uid: 'u1', displayName: 'Test' } as AuthContextValue['user'];
    renderLandingAt('/?returnTo=https%3A%2F%2Fevil.example.com', { user: mockUser });

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('uses stored returnTo when query param is absent', () => {
    window.sessionStorage.setItem('collab-board-return-to', '/board/recover-me');
    const mockUser = { uid: 'u1', displayName: 'Test' } as AuthContextValue['user'];
    renderLandingAt('/', { user: mockUser });

    expect(mockNavigate).toHaveBeenCalledWith('/board/recover-me', { replace: true });
  });

  it('calls signInWithGoogle when the sign-in button is clicked', () => {
    const mockSignIn = vi.fn().mockResolvedValue(undefined);
    renderLanding({ signInWithGoogle: mockSignIn });

    fireEvent.click(screen.getByText('Sign in with Google'));

    expect(mockSignIn).toHaveBeenCalled();
  });

  it('displays an auth error when present', () => {
    renderLanding({ error: 'Popup blocked. Please allow popups and try again.' });

    expect(
      screen.getByText('Popup blocked. Please allow popups and try again.'),
    ).toBeInTheDocument();
  });

  it('does not display error paragraph when there is no error', () => {
    renderLanding({ error: null });

    expect(screen.queryByText(/popup/i)).not.toBeInTheDocument();
  });

  it('renders the preview cards', () => {
    renderLanding();

    expect(screen.getByText('User Flow')).toBeInTheDocument();
    expect(screen.getByText('Pain Points')).toBeInTheDocument();
    expect(screen.getByText('MVP Scope')).toBeInTheDocument();
  });
});
