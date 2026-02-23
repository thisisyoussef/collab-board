import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../context/auth-context';

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({
    socketRef: { current: null },
    status: 'connected' as const,
    reconnectCount: 0,
    connectedSinceMs: Date.now(),
    disconnectedSinceMs: null,
  }),
}));

vi.mock('../hooks/useCursors', () => ({
  useCursors: () => ({
    remoteCursors: [],
    averageLatencyMs: 16,
    publishCursor: vi.fn(),
    publishCursorHide: vi.fn(),
  }),
}));

vi.mock('../hooks/usePresence', () => ({
  usePresence: () => ({
    members: [],
  }),
}));

vi.mock('konva', () => ({
  default: {
    Node: class {},
    Stage: class {},
    Layer: class {},
    Group: class {},
    Rect: class {},
    Circle: class {},
    Line: class {},
    Arrow: class {},
    Text: class {},
    Transformer: class {},
  },
}));

vi.mock('react-konva', () => ({
  Stage: ({ children }: { children?: ReactNode }) => <div data-testid="konva-stage">{children}</div>,
  Layer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Transformer: () => <div />,
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Rect: () => <div />,
  Circle: () => <div />,
  Line: () => <div />,
  Arrow: () => <div />,
  Text: () => <div />,
}));

vi.mock('firebase/firestore/lite', () => ({
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({
    exists: () => true,
    data: () => ({ title: 'Board V2', objects: {} }),
  }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn(() => 'mock-ts'),
}));

vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('../lib/firestore-client', () => ({
  withFirestoreTimeout: (_label: string, promise: Promise<unknown>) => promise,
  toFirestoreUserMessage: (fallback: string) => fallback,
}));

const { Board } = await import('./Board');

const authValue: AuthContextValue = {
  user: {
    uid: 'user-1',
    displayName: 'User One',
    email: 'one@example.com',
    getIdToken: vi.fn().mockResolvedValue('token'),
  } as AuthContextValue['user'],
  loading: false,
  error: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
};

function renderBoard() {
  render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={['/board/board-v2']}>
        <Routes>
          <Route path="/board/:id" element={<Board />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('Board object v2 controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ message: 'ok', toolCalls: [] }),
      } as Response),
    );
  });

  it('shows tool controls for all core primitives', async () => {
    renderBoard();
    await screen.findByText('Board V2');

    expect(screen.getByLabelText('Case card tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Region tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Marker tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Line tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Annotation tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Case group tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Relationship tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Claim node tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Evidence node tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Witness node tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Timeline event node tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Contradiction node tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Supports link tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Contradicts link tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Dependency link tool')).toBeInTheDocument();
  });
});
