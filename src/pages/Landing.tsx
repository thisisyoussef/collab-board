import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Landing() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>CollabBoard</h1>
      <p style={{ color: '#666', marginBottom: '2rem', fontSize: '1.1rem' }}>
        Real-time collaborative whiteboard
      </p>
      <button
        onClick={signIn}
        style={{
          padding: '12px 24px',
          fontSize: '1rem',
          fontWeight: 600,
          background: '#4285F4',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        Sign in with Google
      </button>
    </div>
  );
}
