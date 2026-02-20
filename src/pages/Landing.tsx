// Landing page — the public entry point at "/".
// Shows Google Sign-In button. Supports ?returnTo= parameter to redirect back
// to a shared board after sign-in (e.g., /board/:id redirects here with returnTo
// when auth_link visibility requires sign-in). Persists returnTo in localStorage
// across the OAuth redirect flow.
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const RETURN_TO_STORAGE_KEY = 'collab-board-return-to';

function resolveReturnTo(search: string): string | null {
  const value = new URLSearchParams(search).get('returnTo');
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }
  return value;
}

function readStoredReturnTo(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const value = window.sessionStorage.getItem(RETURN_TO_STORAGE_KEY);
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }
  return value;
}

function clearStoredReturnTo() {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);
}

export function Landing() {
  const { user, loading, error, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = resolveReturnTo(location.search);

  useEffect(() => {
    if (!returnTo || typeof window === 'undefined') {
      return;
    }
    window.sessionStorage.setItem(RETURN_TO_STORAGE_KEY, returnTo);
  }, [returnTo]);

  useEffect(() => {
    if (!loading && user) {
      const target = returnTo || readStoredReturnTo() || '/dashboard';
      clearStoredReturnTo();
      navigate(target, { replace: true });
    }
  }, [loading, user, navigate, returnTo]);

  if (loading) {
    return <div className="centered-screen">Loading auth...</div>;
  }

  return (
    <main className="landing-root">
      <header className="landing-topbar">
        <div className="landing-brand">
          <span className="logo-mark" aria-hidden="true">
            <span className="logo-square logo-square-back" />
            <span className="logo-square logo-square-front" />
          </span>
          <div className="landing-brand-copy">
            <span className="landing-brand-name">CollabBoard</span>
            <span className="landing-brand-subtitle">Design System Preview</span>
          </div>
        </div>
        <div className="landing-top-actions">
          <span className="landing-muted landing-top-caption">Built for clarity under pressure</span>
        </div>
      </header>

      <section className="landing-content-grid">
        <aside className="landing-sidebar">
          <p className="landing-sidebar-kicker">Workspace</p>
          <h2>Command center</h2>
          <p className="landing-muted">Recent boards and quick links</p>
          <div className="landing-sidebar-list">
            <button className="landing-sidebar-item active">
              <span>Product Planning</span>
              <span className="landing-sidebar-tag">Active</span>
            </button>
            <button className="landing-sidebar-item">
              <span>Research Notes</span>
              <span className="landing-sidebar-tag">Review</span>
            </button>
            <button className="landing-sidebar-item">
              <span>Design Critique</span>
              <span className="landing-sidebar-tag">Ready</span>
            </button>
            <button className="landing-sidebar-item">
              <span>Retrospective</span>
              <span className="landing-sidebar-tag">Draft</span>
            </button>
          </div>
        </aside>

        <section className="landing-main-panel">
          <div className="landing-hero">
            <p className="landing-kicker">Collaborative canvas</p>
            <h1>See the whole board, act with confidence.</h1>
            <p>
              Sign in to access your dashboard where you can create, rename, open, and delete
              boards.
            </p>

            <div className="auth-actions">
              <button className="primary-btn landing-primary-btn" onClick={() => void signInWithGoogle()}>
                Sign in with Google
              </button>
            </div>

            {error && <p className="auth-error">{error}</p>}
            <p className="landing-auth-meta">Secure sign-in via Google authentication.</p>
          </div>

          <div className="landing-preview">
            <div className="preview-toolbar">
              <div className="preview-toolbar-copy">
                <span className="preview-toolbar-title">Prototype Board Preview</span>
                <span className="preview-toolbar-meta">Live collaboration demo</span>
              </div>
              <div className="preview-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="preview-canvas">
              <div className="preview-card sticky-a">
                <strong>User Flow</strong>
                <span>Core path</span>
              </div>
              <div className="preview-card sticky-b">
                <strong>Pain Points</strong>
                <span>Open questions</span>
              </div>
              <div className="preview-card sticky-c">
                <strong>MVP Scope</strong>
                <span>Release window</span>
              </div>
              <div className="preview-line" />
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
