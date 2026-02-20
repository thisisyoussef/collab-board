import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('./components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('./pages/Landing', () => ({
  Landing: () => <div>Landing Page</div>,
}));

vi.mock('./pages/Dashboard', () => ({
  Dashboard: () => <div>Dashboard Page</div>,
}));

vi.mock('./pages/Board', () => ({
  Board: () => <div>Board Page</div>,
}));

const { App } = await import('./App');

describe('App routes', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('renders landing on root route', () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(screen.getByText('Landing Page')).toBeInTheDocument();
  });

  it('renders dashboard route', () => {
    window.history.pushState({}, '', '/dashboard');
    render(<App />);
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  it('renders board route', () => {
    window.history.pushState({}, '', '/board/board-123');
    render(<App />);
    expect(screen.getByText('Board Page')).toBeInTheDocument();
  });

  it('does not render the log terminal overlay', () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(screen.queryByTitle('Open log terminal')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Application log terminal')).not.toBeInTheDocument();
  });

  it('redirects unknown routes to landing', () => {
    window.history.pushState({}, '', '/does-not-exist');
    render(<App />);
    expect(screen.getByText('Landing Page')).toBeInTheDocument();
  });
});
