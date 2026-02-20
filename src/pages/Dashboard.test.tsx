import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthContext, type AuthContextValue } from '../context/auth-context';
import type { SharedBoardDashboardEntry } from '../types/sharing';

// Mock useBoards
const mockCreateBoard = vi.fn();
const mockRenameBoard = vi.fn();
const mockRemoveBoard = vi.fn();
let mockBoardsReturn = {
  boards: [] as { id: string; title: string; ownerId: string; createdAtMs: number; updatedAtMs: number }[],
  loading: false,
  error: null as string | null,
  createBoard: mockCreateBoard,
  renameBoard: mockRenameBoard,
  removeBoard: mockRemoveBoard,
};

vi.mock('../hooks/useBoards', () => ({
  useBoards: () => mockBoardsReturn,
}));

let mockSharedBoardsReturn = {
  explicitBoards: [] as SharedBoardDashboardEntry[],
  recentBoards: [] as SharedBoardDashboardEntry[],
  loading: false,
  error: null as string | null,
  reload: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../hooks/useSharedBoards', () => ({
  useSharedBoards: () => mockSharedBoardsReturn,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Must import after mocking
const { Dashboard } = await import('./Dashboard');

const mockUser = {
  uid: 'user-123',
  displayName: 'Test User',
  email: 'test@example.com',
} as AuthContextValue['user'];

const baseAuth: AuthContextValue = {
  user: mockUser,
  loading: false,
  error: null,
  signInWithGoogle: async () => {},
  signOut: vi.fn().mockResolvedValue(undefined),
};

function renderDashboard(
  authOverrides: Partial<AuthContextValue> = {},
  boardsOverrides: Partial<typeof mockBoardsReturn> = {},
  sharedBoardsOverrides: Partial<typeof mockSharedBoardsReturn> = {},
) {
  mockBoardsReturn = {
    boards: [],
    loading: false,
    error: null,
    createBoard: mockCreateBoard,
    renameBoard: mockRenameBoard,
    removeBoard: mockRemoveBoard,
    ...boardsOverrides,
  };
  mockSharedBoardsReturn = {
    explicitBoards: [],
    recentBoards: [],
    loading: false,
    error: null,
    reload: vi.fn().mockResolvedValue(undefined),
    ...sharedBoardsOverrides,
  };

  return render(
    <AuthContext.Provider value={{ ...baseAuth, ...authOverrides }}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Dashboard />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the user display name and avatar', () => {
    renderDashboard();

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('T')).toBeInTheDocument(); // avatar initial
  });

  it('renders the new dashboard layout scaffolding', () => {
    renderDashboard();

    expect(screen.getByText('Workspace overview')).toBeInTheDocument();
    expect(screen.getByText('Board command center')).toBeInTheDocument();
  });

  it('shows loading state while boards are loading', () => {
    renderDashboard({}, { loading: true });

    expect(screen.getByText('Loading your boards...')).toBeInTheDocument();
  });

  it('renders Shared with me tab as available', () => {
    renderDashboard();

    const sharedButton = screen.getByRole('button', { name: 'Shared with me' });
    expect(sharedButton).toBeInTheDocument();
    expect(sharedButton).toBeEnabled();
  });

  it('renders shared dashboard sections when Shared with me is selected', () => {
    renderDashboard(
      {},
      {},
      {
        explicitBoards: [
          {
            id: 'shared-1',
            title: 'Shared Planning',
            ownerId: 'owner-1',
            createdAtMs: 1000,
            updatedAtMs: 3000,
            role: 'viewer',
            source: 'explicit',
          },
        ],
        recentBoards: [
          {
            id: 'recent-1',
            title: 'Recent Retro',
            ownerId: 'owner-2',
            createdAtMs: 1200,
            updatedAtMs: 2200,
            lastOpenedAtMs: 5000,
            source: 'recent',
          },
        ],
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Shared with me' }));

    expect(screen.getByRole('heading', { name: 'Shared with me' })).toBeInTheDocument();
    expect(screen.getByText('Shared directly')).toBeInTheDocument();
    expect(screen.getByText('Recent shared links')).toBeInTheDocument();
    expect(screen.getByText('Shared Planning')).toBeInTheDocument();
    expect(screen.getByText('Recent Retro')).toBeInTheDocument();
  });

  it('opens shared board cards from Shared with me view', () => {
    renderDashboard(
      {},
      {},
      {
        explicitBoards: [
          {
            id: 'shared-2',
            title: 'Shared Execution',
            ownerId: 'owner-3',
            createdAtMs: 1000,
            updatedAtMs: 3000,
            role: 'editor',
            source: 'explicit',
          },
        ],
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Shared with me' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open shared board Shared Execution' }));

    expect(mockNavigate).toHaveBeenCalledWith('/board/shared-2');
  });

  it('shows empty state when no boards exist', () => {
    renderDashboard({}, { boards: [] });

    expect(screen.getByText('No boards yet. Create your first board above.')).toBeInTheDocument();
  });

  it('displays board count label for multiple boards', () => {
    renderDashboard({}, {
      boards: [
        { id: 'b1', title: 'Board 1', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 2000 },
        { id: 'b2', title: 'Board 2', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 3000 },
      ],
    });

    expect(screen.getByText('2 boards')).toBeInTheDocument();
  });

  it('displays singular board count label', () => {
    renderDashboard({}, {
      boards: [
        { id: 'b1', title: 'Board 1', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 2000 },
      ],
    });

    expect(screen.getByText('1 board')).toBeInTheDocument();
  });

  it('renders board cards with Open, Rename, and Delete buttons', () => {
    renderDashboard({}, {
      boards: [
        { id: 'b1', title: 'Sprint Plan', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 2000 },
      ],
    });

    expect(screen.getByText('Sprint Plan')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('navigates to board page when Open is clicked', () => {
    renderDashboard({}, {
      boards: [
        { id: 'b1', title: 'Sprint Plan', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 2000 },
      ],
    });

    fireEvent.click(screen.getByText('Open'));
    expect(mockNavigate).toHaveBeenCalledWith('/board/b1');
  });

  it('calls createBoard and navigates on form submit after commit resolves', async () => {
    mockCreateBoard.mockReturnValue({
      id: 'new-board-id',
      committed: Promise.resolve(),
    });

    renderDashboard();

    const input = screen.getByPlaceholderText('New board name');
    fireEvent.change(input, { target: { value: 'My New Board' } });
    fireEvent.submit(input.closest('form')!);

    expect(mockCreateBoard).toHaveBeenCalledWith('My New Board');
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/board/new-board-id');
    });
  });

  it('shows rename input when Rename is clicked', () => {
    renderDashboard({}, {
      boards: [
        { id: 'b1', title: 'Sprint Plan', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 2000 },
      ],
    });

    fireEvent.click(screen.getByText('Rename'));

    // Should now show an input with current title and Save/Cancel buttons
    const renameInput = screen.getByDisplayValue('Sprint Plan');
    expect(renameInput).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls renameBoard when Save is clicked', async () => {
    mockRenameBoard.mockResolvedValue(undefined);

    renderDashboard({}, {
      boards: [
        { id: 'b1', title: 'Sprint Plan', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 2000 },
      ],
    });

    fireEvent.click(screen.getByText('Rename'));

    const renameInput = screen.getByDisplayValue('Sprint Plan');
    fireEvent.change(renameInput, { target: { value: 'Sprint Plan V2' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockRenameBoard).toHaveBeenCalledWith('b1', 'Sprint Plan V2');
    });
  });

  it('cancels rename when Cancel is clicked', () => {
    renderDashboard({}, {
      boards: [
        { id: 'b1', title: 'Sprint Plan', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 2000 },
      ],
    });

    fireEvent.click(screen.getByText('Rename'));
    expect(screen.getByDisplayValue('Sprint Plan')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    // Should be back to displaying the title as text
    expect(screen.getByText('Sprint Plan')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Sprint Plan')).not.toBeInTheDocument();
  });

  it('shows error message when board loading fails', () => {
    renderDashboard({}, { error: 'Unable to load boards right now.' });

    expect(screen.getByText('Unable to load boards right now.')).toBeInTheDocument();
  });

  it('calls signOut when Sign out is clicked', () => {
    const mockSignOut = vi.fn().mockResolvedValue(undefined);
    renderDashboard({ signOut: mockSignOut });

    fireEvent.click(screen.getByText('Sign out'));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('shows Delete confirmation when Delete is clicked', () => {
    const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderDashboard({}, {
      boards: [
        { id: 'b1', title: 'Sprint Plan', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 2000 },
      ],
    });

    fireEvent.click(screen.getByText('Delete'));

    expect(mockConfirm).toHaveBeenCalledWith('Delete "Sprint Plan"? This action cannot be undone.');
    mockConfirm.mockRestore();
  });

  it('calls removeBoard when delete is confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockRemoveBoard.mockResolvedValue(undefined);

    renderDashboard({}, {
      boards: [
        { id: 'b1', title: 'Sprint Plan', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 2000 },
      ],
    });

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockRemoveBoard).toHaveBeenCalledWith('b1');
    });

    vi.restoreAllMocks();
  });
});
