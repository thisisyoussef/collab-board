import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function resolveReturnTo(search: string): string | null {
  const value = new URLSearchParams(search).get('returnTo');
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }
  return value;
}

export function Landing() {
  const { user, loading, error, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = resolveReturnTo(location.search);

  useEffect(() => {
    if (!loading && user) {
      navigate(returnTo || '/dashboard', { replace: true });
    }
  }, [loading, user, navigate, returnTo]);

  if (loading) {
    return <div className="centered-screen">Loading auth...</div>;
  }

  return (
    <main className="landing-root">
      <header className="landing-topbar">
        <div className="landing-brand">
          <span className="logo-dot" />
          <span>CollabBoard</span>
        </div>
        <div className="landing-top-actions">
          <span className="landing-muted">Figma-style multiplayer shell</span>
        </div>
      </header>

      <section className="landing-content-grid">
        <aside className="landing-sidebar">
          <h2>Workspace</h2>
          <p className="landing-muted">Recent boards and quick links</p>
          <div className="sidebar-list">
            <button className="sidebar-item active">Product Planning</button>
            <button className="sidebar-item">Research Notes</button>
            <button className="sidebar-item">Design Critique</button>
            <button className="sidebar-item">Retrospective</button>
          </div>
        </aside>

        <section className="landing-main-panel">
          <div className="landing-hero">
            <h1>Collaborate on a canvas, Figma-style</h1>
            <p>
              Sign in to access your dashboard where you can create, rename, open, and delete
              boards.
            </p>

            <button className="primary-btn" onClick={() => void signInWithGoogle()}>
              Sign in with Google
            </button>

            {error && <p className="auth-error">{error}</p>}
          </div>

          <div className="landing-preview">
            <div className="preview-toolbar">
              <span>Prototype Board Preview</span>
              <div className="preview-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="preview-canvas">
              <div className="preview-card sticky-a">User Flow</div>
              <div className="preview-card sticky-b">Pain Points</div>
              <div className="preview-card sticky-c">MVP Scope</div>
              <div className="preview-line" />
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
