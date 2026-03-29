import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthContext, type AuthContextValue } from '../context/auth-context';
import type { SharedBoardDashboardEntry } from '../types/sharing';

// Mock useBoards
const mockCreateBoard = vi.fn();
const mockCreateBoardFromTemplate = vi.fn();
const mockRenameBoard = vi.fn();
const mockRemoveBoard = vi.fn();
const mockReloadBoards = vi.fn().mockResolvedValue(undefined);
let mockBoardsReturn = {
  boards: [] as { id: string; title: string; ownerId: string; createdAtMs: number; updatedAtMs: number }[],
  loading: false,
  error: null as string | null,
  createBoard: mockCreateBoard,
  createBoardFromTemplate: mockCreateBoardFromTemplate,
  renameBoard: mockRenameBoard,
  removeBoard: mockRemoveBoard,
  reload: mockReloadBoards,
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
    createBoardFromTemplate: mockCreateBoardFromTemplate,
    renameBoard: mockRenameBoard,
    removeBoard: mockRemoveBoard,
    reload: mockReloadBoards,
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

    expect(screen.getByText('Caseload overview')).toBeInTheDocument();
    expect(screen.getByText('Case command center')).toBeInTheDocument();
  });

  it('shows loading state while boards are loading', () => {
    renderDashboard({}, { loading: true });

    expect(screen.getByText('Loading your cases...')).toBeInTheDocument();
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
    expect(screen.getByText('Shared by co-counsel')).toBeInTheDocument();
    expect(screen.getByText('Recent case links')).toBeInTheDocument();
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

    expect(screen.getByText('No cases yet. Create your first litigation board above.')).toBeInTheDocument();
  });

  it('displays board count label for multiple boards', () => {
    renderDashboard({}, {
      boards: [
        { id: 'b1', title: 'Board 1', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 2000 },
        { id: 'b2', title: 'Board 2', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 3000 },
      ],
    });

    expect(screen.getByText('2 cases')).toBeInTheDocument();
  });

  it('displays singular board count label', () => {
    renderDashboard({}, {
      boards: [
        { id: 'b1', title: 'Board 1', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 2000 },
      ],
    });

    expect(screen.getByText('1 case')).toBeInTheDocument();
  });

  it('filters owned cases by search query', () => {
    renderDashboard({}, {
      boards: [
        { id: 'b1', title: 'Smith v. Acme', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 2000 },
        { id: 'b2', title: 'Johnson Intake', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 3000 },
      ],
    });

    fireEvent.change(screen.getByLabelText('Search cases'), { target: { value: 'johnson' } });

    expect(screen.getByText('Johnson Intake')).toBeInTheDocument();
    expect(screen.queryByText('Smith v. Acme')).not.toBeInTheDocument();
  });

  it('shows a no-match empty state when owned-case search has no results', () => {
    renderDashboard({}, {
      boards: [
        { id: 'b1', title: 'Smith v. Acme', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 2000 },
      ],
    });

    fireEvent.change(screen.getByLabelText('Search cases'), { target: { value: 'does-not-exist' } });

    expect(screen.getByText('No cases match your search.')).toBeInTheDocument();
  });

  it('shows clear-search action only when active-tab search has text', () => {
    renderDashboard();

    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search cases'), { target: { value: 'smith' } });

    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
  });

  it('clears owned-tab search and restores all owned cases', () => {
    renderDashboard({}, {
      boards: [
        { id: 'b1', title: 'Smith v. Acme', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 2000 },
        { id: 'b2', title: 'Johnson Intake', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 3000 },
      ],
    });

    fireEvent.change(screen.getByLabelText('Search cases'), { target: { value: 'johnson' } });
    expect(screen.getByDisplayValue('johnson')).toBeInTheDocument();
    expect(screen.queryByText('Smith v. Acme')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(screen.getByDisplayValue('')).toBeInTheDocument();
    expect(screen.getByText('Smith v. Acme')).toBeInTheDocument();
    expect(screen.getByText('Johnson Intake')).toBeInTheDocument();
  });

  it('filters shared sections by search query', () => {
    renderDashboard(
      {},
      {},
      {
        explicitBoards: [
          {
            id: 'shared-1',
            title: 'Trial Strategy',
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
            title: 'Deposition Notes',
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
    fireEvent.change(screen.getByLabelText('Search cases'), { target: { value: 'deposition' } });

    expect(screen.getByText('Deposition Notes')).toBeInTheDocument();
    expect(screen.queryByText('Trial Strategy')).not.toBeInTheDocument();
  });

  it('clears only shared-tab search without resetting owned-tab query', () => {
    renderDashboard(
      {},
      {
        boards: [
          { id: 'owned-1', title: 'Smith v. Acme', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 3000 },
          { id: 'owned-2', title: 'Johnson Intake', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 2000 },
        ],
      },
      {
        explicitBoards: [
          {
            id: 'shared-1',
            title: 'Trial Strategy',
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
            title: 'Deposition Notes',
            ownerId: 'owner-2',
            createdAtMs: 1200,
            updatedAtMs: 2200,
            lastOpenedAtMs: 5000,
            source: 'recent',
          },
        ],
      },
    );

    fireEvent.change(screen.getByLabelText('Search cases'), { target: { value: 'johnson' } });
    fireEvent.click(screen.getByRole('button', { name: 'Shared with me' }));
    fireEvent.change(screen.getByLabelText('Search cases'), { target: { value: 'deposition' } });

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(screen.getByDisplayValue('')).toBeInTheDocument();
    expect(screen.getByText('Deposition Notes')).toBeInTheDocument();
    expect(screen.getByText('Trial Strategy')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All cases' }));
    expect(screen.getByDisplayValue('johnson')).toBeInTheDocument();
    expect(screen.getByText('Johnson Intake')).toBeInTheDocument();
    expect(screen.queryByText('Smith v. Acme')).not.toBeInTheDocument();
  });

  it('keeps owned-case search query when switching away and back', () => {
    renderDashboard(
      {},
      {
        boards: [
          { id: 'owned-1', title: 'Smith v. Acme', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 3000 },
          { id: 'owned-2', title: 'Johnson Intake', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 2000 },
        ],
      },
      {
        explicitBoards: [
          {
            id: 'shared-1',
            title: 'Deposition Timeline',
            ownerId: 'owner-1',
            createdAtMs: 1000,
            updatedAtMs: 3000,
            role: 'viewer',
            source: 'explicit',
          },
        ],
      },
    );

    fireEvent.change(screen.getByLabelText('Search cases'), { target: { value: 'johnson' } });
    expect(screen.getByDisplayValue('johnson')).toBeInTheDocument();
    expect(screen.getByText('Johnson Intake')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Shared with me' }));
    expect(screen.getByDisplayValue('')).toBeInTheDocument();
    expect(screen.getByText('Deposition Timeline')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All cases' }));
    expect(screen.getByDisplayValue('johnson')).toBeInTheDocument();
    expect(screen.getByText('Johnson Intake')).toBeInTheDocument();
    expect(screen.queryByText('Smith v. Acme')).not.toBeInTheDocument();
  });

  it('keeps shared-case search query when switching away and back', () => {
    renderDashboard(
      {},
      {
        boards: [
          { id: 'owned-1', title: 'Smith v. Acme', ownerId: 'user-123', createdAtMs: 1000, updatedAtMs: 3000 },
        ],
      },
      {
        explicitBoards: [
          {
            id: 'shared-1',
            title: 'Trial Strategy',
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
            title: 'Deposition Notes',
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
    fireEvent.change(screen.getByLabelText('Search cases'), { target: { value: 'deposition' } });
    expect(screen.getByDisplayValue('deposition')).toBeInTheDocument();
    expect(screen.getByText('Deposition Notes')).toBeInTheDocument();
    expect(screen.queryByText('Trial Strategy')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All cases' }));
    expect(screen.getByDisplayValue('')).toBeInTheDocument();
    expect(screen.getByText('Smith v. Acme')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Shared with me' }));
    expect(screen.getByDisplayValue('deposition')).toBeInTheDocument();
    expect(screen.getByText('Deposition Notes')).toBeInTheDocument();
    expect(screen.queryByText('Trial Strategy')).not.toBeInTheDocument();
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

    const input = screen.getByPlaceholderText('New case name (e.g., Smith v. Acme)');
    fireEvent.change(input, { target: { value: 'My New Board' } });
    fireEvent.submit(input.closest('form')!);

    expect(mockCreateBoard).toHaveBeenCalledWith('My New Board');
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/board/new-board-id');
    });
  });

  it('creates a board from selected template and navigates after commit resolves', async () => {
    mockCreateBoardFromTemplate.mockReturnValue({
      id: 'template-board-id',
      committed: Promise.resolve(),
    });

    renderDashboard();

    fireEvent.change(screen.getByLabelText('Case template'), { target: { value: 'johnson' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create from template' }));

    expect(mockCreateBoardFromTemplate).toHaveBeenCalledWith('johnson');
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/board/template-board-id');
    });
  });

  it('keeps create from template disabled until a template is selected', () => {
    renderDashboard();

    expect(screen.getByRole('button', { name: 'Create from template' })).toBeDisabled();
  });

  it('prevents duplicate template create requests while a template commit is pending', async () => {
    let resolveCommit: (() => void) | null = null;
    const pendingCommit = new Promise<void>((resolve) => {
      resolveCommit = resolve;
    });
    mockCreateBoardFromTemplate.mockReturnValue({
      id: 'template-board-id',
      committed: pendingCommit,
    });

    renderDashboard();

    fireEvent.change(screen.getByLabelText('Case template'), { target: { value: 'defectco' } });
    const createFromTemplateButton = screen.getByRole('button', { name: 'Create from template' });

    fireEvent.click(createFromTemplateButton);
    fireEvent.click(createFromTemplateButton);

    expect(mockCreateBoardFromTemplate).toHaveBeenCalledTimes(1);
    expect(createFromTemplateButton).toBeDisabled();
    expect(createFromTemplateButton).toHaveTextContent('Creating...');

    resolveCommit?.();

    await waitFor(() => {
      expect(createFromTemplateButton).not.toBeDisabled();
      expect(createFromTemplateButton).toHaveTextContent('Create from template');
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

    expect(mockConfirm).toHaveBeenCalledWith('Delete case "Sprint Plan"? This action cannot be undone.');
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

  it('retries loading owned boards from error state', async () => {
    let resolveRetry: (() => void) | null = null;
    const retryPromise = new Promise<void>((resolve) => {
      resolveRetry = resolve;
    });
    mockReloadBoards.mockReturnValueOnce(retryPromise);

    renderDashboard({}, { error: 'Unable to load boards right now.' });

    const retryButton = screen.getByRole('button', { name: 'Retry loading cases' });
    fireEvent.click(retryButton);
    fireEvent.click(retryButton);

    expect(mockReloadBoards).toHaveBeenCalledTimes(1);
    expect(retryButton).toBeDisabled();
    expect(retryButton).toHaveTextContent('Retrying...');

    resolveRetry?.();

    await waitFor(() => {
      expect(retryButton).not.toBeDisabled();
      expect(retryButton).toHaveTextContent('Retry');
    });
  });

  it('retries loading shared boards from error state', async () => {
    const mockReloadShared = vi.fn().mockResolvedValue(undefined);

    renderDashboard(
      {},
      {},
      {
        error: 'Unable to load shared boards right now.',
        reload: mockReloadShared,
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Shared with me' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading shared cases' }));

    await waitFor(() => {
      expect(mockReloadShared).toHaveBeenCalledTimes(1);
    });
  });
});
