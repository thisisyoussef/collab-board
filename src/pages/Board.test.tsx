import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthContext, type AuthContextValue } from '../context/auth-context';

// Mock useSocket
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
    averageLatencyMs: 20,
    publishCursor: vi.fn(),
  }),
}));

vi.mock('../hooks/usePresence', () => ({
  usePresence: () => ({
    members: [
      {
        socketId: 'socket-1',
        userId: 'user-123',
        displayName: 'Test User',
        color: 'hsl(210, 65%, 55%)',
      },
    ],
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
    Arrow: class {},
    Line: class {},
    Transformer: class {},
    Text: class {},
  },
}));

vi.mock('react-konva', () => ({
  Stage: ({ children }: { children: ReactNode }) => <div data-testid="konva-stage">{children}</div>,
  Layer: ({ children }: { children?: ReactNode }) => <div data-testid="konva-layer">{children}</div>,
  Transformer: () => <div data-testid="konva-transformer" />,
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Line: () => <div />,
  Arrow: () => <div />,
  Rect: () => <div />,
  Circle: () => <div />,
  Text: () => <div />,
}));

// Mock Firestore
vi.mock('firebase/firestore/lite', () => ({
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({
    exists: () => true,
    data: () => ({ title: 'Test Board Title' }),
  }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

vi.mock('../lib/firebase', () => ({
  db: {},
}));

vi.mock('../lib/firestore-client', () => ({
  withFirestoreTimeout: (_label: string, promise: Promise<unknown>) => promise,
  toFirestoreUserMessage: (fallback: string) => fallback,
}));

const mockNavigate = vi.fn();
const mockClipboardWriteText = vi.fn().mockResolvedValue(undefined);
const mockGetIdToken = vi.fn().mockResolvedValue('mock-firebase-id-token');
const mockFetch = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Import after mocking
const { Board } = await import('./Board');

const mockUser = {
  uid: 'user-123',
  displayName: 'Test User',
  email: 'test@example.com',
  getIdToken: mockGetIdToken,
} as AuthContextValue['user'];

const baseAuth: AuthContextValue = {
  user: mockUser,
  loading: false,
  error: null,
  signInWithGoogle: async () => {},
  signOut: vi.fn().mockResolvedValue(undefined),
};

function renderBoard(boardId = 'board-abc', authOverrides: Partial<AuthContextValue> = {}) {
  render(
    <AuthContext.Provider value={{ ...baseAuth, ...authOverrides }}>
      <MemoryRouter initialEntries={[`/board/${boardId}`]}>
        <Routes>
          <Route path="/board/:id" element={<Board />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

async function renderBoardReady(boardId = 'board-abc', authOverrides: Partial<AuthContextValue> = {}) {
  renderBoard(boardId, authOverrides);
  await screen.findByText('Test Board Title');
}

describe('Board', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        message: 'Plan ready.',
        toolCalls: [],
      }),
    } as Response);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockClipboardWriteText,
      },
      configurable: true,
    });
  });

  it('renders the Figma-like layout structure', async () => {
    await renderBoardReady();

    // Verify layout elements
    expect(screen.getByText('CollabBoard')).toBeInTheDocument();
    expect(screen.getByText('Properties')).toBeInTheDocument();
    expect(screen.getByText('AI Command Center')).toBeInTheDocument();
    expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
  });

  it('renders the socket status indicator', async () => {
    await renderBoardReady();

    // Should show connected status
    expect(screen.getByText('🟢 Live')).toBeInTheDocument();
  });

  it('renders the topbar tool buttons', async () => {
    await renderBoardReady();

    expect(screen.getByText('Move')).toBeInTheDocument();
    expect(screen.getByText('Frame')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByText('Shape')).toBeInTheDocument();
  });

  it('renders the left rail buttons', async () => {
    await renderBoardReady();

    // Rail buttons
    expect(screen.getByText('↖')).toBeInTheDocument();
    expect(screen.getByText('□')).toBeInTheDocument();
    expect(screen.getByText('○')).toBeInTheDocument();
    expect(screen.getByText('◯')).toBeInTheDocument();
    expect(screen.getByText('／')).toBeInTheDocument();
    expect(screen.getByText('T')).toBeInTheDocument();
    expect(screen.getByText('⌗')).toBeInTheDocument();
    const railButtons = document.querySelectorAll('.rail-btn');
    expect(railButtons.length).toBe(8);
    expect(screen.getByText('↔')).toBeInTheDocument();
  });

  it('renders the right properties panel', async () => {
    await renderBoardReady();

    expect(screen.getByText('Properties')).toBeInTheDocument();
    expect(screen.getByText('Selection')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.getByText('Zoom')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('shows the presence avatar in the topbar', async () => {
    await renderBoardReady();

    const avatar = screen.getByLabelText('Test User');
    expect(avatar).toBeInTheDocument();
    expect(avatar.textContent).toBe('TU');
  });

  it('navigates to dashboard when Dashboard button is clicked', async () => {
    await renderBoardReady();

    fireEvent.click(screen.getByText('Dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('enters title editing mode when Rename is clicked', async () => {
    await renderBoardReady();

    fireEvent.click(screen.getByText('Rename'));

    const titleInput = screen.getByDisplayValue('Test Board Title');
    expect(titleInput).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('cancels title editing when Cancel is clicked', async () => {
    await renderBoardReady();

    fireEvent.click(screen.getByText('Rename'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.getByText('Test Board Title')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Test Board Title')).not.toBeInTheDocument();
  });

  it('cancels title editing when Escape is pressed', async () => {
    await renderBoardReady();

    fireEvent.click(screen.getByText('Rename'));
    const input = screen.getByDisplayValue('Test Board Title');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.getByText('Test Board Title')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Test Board Title')).not.toBeInTheDocument();
  });

  it('copies the board link when Share is clicked', async () => {
    await renderBoardReady('board-share-test');

    fireEvent.click(screen.getByText('Share'));

    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalledWith(
        `${window.location.origin}/board/board-share-test`,
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });
  });

  it('submits an AI prompt and renders returned action preview', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        message: 'Created a starting idea.',
        toolCalls: [
          {
            id: 'tool-1',
            name: 'createStickyNote',
            input: {
              text: 'Kickoff',
              x: 120,
              y: 160,
              color: '#FFEB3B',
            },
          },
        ],
      }),
    } as Response);

    await renderBoardReady('board-ai-test');

    fireEvent.change(screen.getByLabelText('AI prompt'), {
      target: { value: 'Create a kickoff sticky note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Plan' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/generate',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    await screen.findByText('Created a starting idea.');
    expect(screen.getByText('createStickyNote')).toBeInTheDocument();
    expect(screen.getByText(/Preview mode requires manual Apply./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply changes' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Undo last AI apply' })).toBeDisabled();
  });
});
