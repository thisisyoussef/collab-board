import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LogTerminal } from './components/LogTerminal';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { Board } from './pages/Board';
import { Dashboard } from './pages/Dashboard';
import { Landing } from './pages/Landing';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public marketing/login entrypoint */}
          <Route path="/" element={<Landing />} />
          <Route
            path="/dashboard"
            element={
              // Dashboard is owner workspace and always requires auth.
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/board/:id"
            // Board route stays shareable so guests can join collaboration links.
            element={<Board />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      {/* Global log terminal — visible in dev mode or when VITE_ENABLE_LOGS=true */}
      <LogTerminal />
    </AuthProvider>
  );
}
