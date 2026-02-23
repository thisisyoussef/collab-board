import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { getDoc, setDoc } from 'firebase/firestore/lite';
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
  collection: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  getDoc: vi.fn().mockResolvedValue({
    exists: () => true,
    data: () => ({ title: 'Test Board Title' }),
  }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
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
    mockNavigate.mockReset();
    mockClipboardWriteText.mockReset();
    mockFetch.mockReset();
    vi.mocked(getDoc).mockReset();
    vi.mocked(setDoc).mockReset();

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ title: 'Test Board Title' }),
    } as never);
    vi.mocked(setDoc).mockResolvedValue(undefined as never);
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
    expect(screen.getByText('CollabBoard')).toHaveClass('topbar-title-text');
    expect(screen.getByText('Test Board Title')).toHaveClass('topbar-title-text');
    expect(screen.getByText('Case element inspector')).toBeInTheDocument();
    expect(screen.getByText('AI Case Assistant')).toBeInTheDocument();
    expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
  });

  it('opens litigation intake dialog from right panel action', async () => {
    await renderBoardReady();

    fireEvent.click(screen.getByRole('button', { name: 'Open Litigation Intake' }));
    expect(screen.getByRole('dialog', { name: 'Litigation board intake' })).toBeInTheDocument();
  });

  it('renders claim strength heatmap panel in the right rail', async () => {
    await renderBoardReady();

    expect(screen.getByText('Claim strength heatmap')).toBeInTheDocument();
    expect(screen.getByText('Tag at least one claim node to compute strength.')).toBeInTheDocument();
  });

  it('renders the new board command shell scaffolding', async () => {
    await renderBoardReady();

    expect(screen.getByText('Litigation workspace')).toBeInTheDocument();
    expect(screen.getByText('Figma for lawyers')).toBeInTheDocument();
    expect(screen.getByText('Design your case theory')).toBeInTheDocument();
    expect(screen.getByText('Session note')).toBeInTheDocument();
  });

  it('does not render the realtime metrics overlay panel', async () => {
    await renderBoardReady();

    expect(screen.queryByLabelText('Realtime metrics overlay')).not.toBeInTheDocument();
  });

  it('renders the socket status indicator', async () => {
    await renderBoardReady();

    // Should show connected status
    expect(screen.getByText('🟢 Live')).toBeInTheDocument();
  });

  it('renders the topbar tool buttons', async () => {
    await renderBoardReady();

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Legal quick start' })).toBeEnabled();
  });

  it('renders the bottom tool dock buttons', async () => {
    await renderBoardReady();

    expect(screen.getByRole('toolbar', { name: 'Board tools' })).toBeInTheDocument();
    expect(screen.getByLabelText('Select tool')).toBeInTheDocument();
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

  it('treats Backspace as a delete shortcut when not typing', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    await renderBoardReady();

    const keydownRegistration = addEventListenerSpy.mock.calls.find(([eventName]) => eventName === 'keydown');
    expect(keydownRegistration).toBeDefined();
    if (!keydownRegistration) {
      throw new Error('Expected keydown listener registration');
    }

    const onKeyDown = keydownRegistration[1] as (event: KeyboardEvent) => void;
    const preventDefault = vi.fn();

    onKeyDown({
      key: 'Backspace',
      ctrlKey: false,
      metaKey: false,
      target: document.body,
      preventDefault,
    } as unknown as KeyboardEvent);

    expect(preventDefault).toHaveBeenCalled();
  });

  it('renders the right inspector panel', async () => {
    await renderBoardReady();

    const inspectorHeading = screen.getByRole('heading', { name: 'Case element inspector' });
    const inspectorPanel = inspectorHeading.closest('section');
    expect(inspectorPanel).not.toBeNull();
    if (!inspectorPanel) {
      throw new Error('Inspector panel missing');
    }
    const inspector = within(inspectorPanel);
    expect(inspector.getByText('Selection')).toBeInTheDocument();
    expect(inspector.getByText('None')).toBeInTheDocument();
    expect(inspector.getByText('Zoom')).toBeInTheDocument();
    expect(inspector.getByText('100%')).toBeInTheDocument();
  });

  it('shows the presence avatar in the topbar', async () => {
    await renderBoardReady();

    const avatar = screen.getByLabelText('Test User');
    expect(avatar).toBeInTheDocument();
    expect(avatar.textContent).toBe('TU');
  });

  it('navigates to dashboard when Cases button is clicked', async () => {
    await renderBoardReady();

    fireEvent.click(screen.getByText('Cases'));
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

  it('opens share panel and copies board link', async () => {
    await renderBoardReady('board-share-test');

    fireEvent.click(screen.getByText('Share'));
    expect(await screen.findByText('Share case board')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));

    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalledWith(
        `${window.location.origin}/board/board-share-test`,
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });
  });

  it('allows collaborators to save a shared board to workspace from share panel', async () => {
    const boardSnapshot = {
      exists: () => true,
      data: () => ({
        title: 'Shared Board',
        ownerId: 'owner-123',
        sharing: { visibility: 'auth_link', authLinkRole: 'editor', publicLinkRole: 'viewer' },
      }),
    };
    const noMemberSnapshot = {
      exists: () => false,
      data: () => ({}),
    };
    const defaultSnapshot = {
      exists: () => true,
      data: () => ({ title: 'Shared Board', objects: {} }),
    };

    vi.mocked(getDoc)
      .mockResolvedValue(defaultSnapshot as never)
      .mockResolvedValueOnce(boardSnapshot as never)
      .mockResolvedValueOnce(noMemberSnapshot as never)
      .mockResolvedValueOnce(defaultSnapshot as never)
      .mockResolvedValueOnce(defaultSnapshot as never)
      .mockResolvedValueOnce(noMemberSnapshot as never);

    renderBoard('board-shared');
    await screen.findByText('Shared Board');

    fireEvent.click(screen.getByText('Share'));
    fireEvent.click(await screen.findByRole('button', { name: 'Save to my caseload' }));

    await waitFor(() => {
      expect(setDoc).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('Saved')).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText('Case AI prompt'), {
      target: { value: 'Create a kickoff sticky note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/generate',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    await expect(screen.findAllByText('Created a starting idea.')).resolves.toHaveLength(1);
    expect(screen.getByText('createStickyNote')).toBeInTheDocument();
    expect(screen.getByText('Conversation')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview mode' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply changes' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Undo last change' })).toBeDisabled();
  });

  it('redirects signed-out users to landing with returnTo when board access is denied', async () => {
    const deniedError = Object.assign(new Error('permission denied'), { code: 'permission-denied' });
    vi.mocked(getDoc).mockRejectedValueOnce(deniedError);

    renderBoard('board-private', { user: null });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/?returnTo=%2Fboard%2Fboard-private', {
        replace: true,
      });
    });
  });

  it('renders viewer sessions in read-only mode', async () => {
    const boardSnapshot = {
      exists: () => true,
      data: () => ({
        title: 'Viewer Board',
        ownerId: 'owner-xyz',
        sharing: { visibility: 'private' },
      }),
    };
    const memberSnapshot = {
      exists: () => true,
      data: () => ({ role: 'viewer' }),
    };
    const defaultSnapshot = {
      exists: () => true,
      data: () => ({ title: 'Viewer Board', objects: {} }),
    };

    vi.mocked(getDoc)
      .mockResolvedValue(defaultSnapshot as never)
      .mockResolvedValueOnce(boardSnapshot as never)
      .mockResolvedValueOnce(memberSnapshot as never)
      .mockResolvedValueOnce(defaultSnapshot as never)
      .mockResolvedValueOnce(defaultSnapshot as never);

    renderBoard('board-viewer');
    await screen.findByText('Viewer Board');

    expect(screen.getByLabelText('Case card tool')).toBeDisabled();
    expect(screen.getByLabelText('Evidence node tool')).toBeDisabled();
    expect(screen.getByLabelText('Contradicts link tool')).toBeDisabled();
    expect(screen.getByLabelText('Case AI prompt')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Legal quick start' })).toBeDisabled();
    expect(screen.getByText(/Read-only mode/i)).toBeInTheDocument();
  });

  it('shows read-only sharing message for non-owner users', async () => {
    const boardSnapshot = {
      exists: () => true,
      data: () => ({
        title: 'Shared Board',
        ownerId: 'owner-123',
        sharing: { visibility: 'auth_link', authLinkRole: 'viewer', publicLinkRole: 'viewer' },
      }),
    };
    const noMemberSnapshot = {
      exists: () => false,
      data: () => ({}),
    };
    const defaultSnapshot = {
      exists: () => true,
      data: () => ({ title: 'Shared Board', objects: {} }),
    };

    vi.mocked(getDoc)
      .mockResolvedValue(defaultSnapshot as never)
      .mockResolvedValueOnce(boardSnapshot as never)
      .mockResolvedValueOnce(noMemberSnapshot as never)
      .mockResolvedValueOnce(defaultSnapshot as never)
      .mockResolvedValueOnce(defaultSnapshot as never);

    renderBoard('board-shared-readonly');
    await screen.findByText('Shared Board');

    fireEvent.click(screen.getByText('Share'));

    expect(await screen.findByText('Only lead counsel can change sharing settings.')).toBeInTheDocument();
  });

  it('renders the contradiction radar panel in the right rail', async () => {
    await renderBoardReady();

    expect(screen.getByText('Contradiction Radar')).toBeInTheDocument();
    expect(
      screen.getByText('AI-detected contradictions between selected sources.'),
    ).toBeInTheDocument();
  });

  it('renders Time Machine button that is disabled when history is empty', async () => {
    await renderBoardReady();

    const btn = screen.getByRole('button', { name: /time machine/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
  });
});
