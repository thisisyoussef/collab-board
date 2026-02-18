import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="centered-screen">Checking session...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
