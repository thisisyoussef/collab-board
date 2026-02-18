import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AuthContext, type AuthContextValue } from '../context/auth-context';

// Mock socket.io-client before importing the hook
const mockSocket = {
  on: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  removeAllListeners: vi.fn(),
  auth: {} as Record<string, unknown>,
};

const mockIo = vi.fn(() => mockSocket);

vi.mock('socket.io-client', () => ({
  io: mockIo,
}));

// Must import after mocking
const { useSocket } = await import('./useSocket');

const mockGetIdToken = vi.fn().mockResolvedValue('mock-firebase-token');

function createWrapper(user: AuthContextValue['user'] = null) {
  const mockValue: AuthContextValue = {
    user,
    loading: false,
    error: null,
    signInWithGoogle: async () => {},
    signOut: async () => {},
  };
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthContext.Provider value={mockValue}>{children}</AuthContext.Provider>;
  };
}

describe('useSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset VITE env
    import.meta.env.VITE_SOCKET_SERVER_URL = 'https://test-socket.example.com';
    window.localStorage.removeItem?.('collab-board-guest-id');
  });

  afterEach(() => {
    delete import.meta.env.VITE_SOCKET_SERVER_URL;
  });

  it('connects as guest when no user is provided', async () => {
    const { result } = renderHook(() => useSocket('board-1'), {
      wrapper: createWrapper(null),
    });

    expect(result.current.status).toBe('connecting');

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockIo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        auth: expect.objectContaining({
          guest: true,
          guestId: expect.stringMatching(/^guest-/),
          guestName: expect.stringMatching(/^Guest /),
        }),
      }),
    );
    expect(mockSocket.connect).toHaveBeenCalled();
  });

  it('returns disconnected status when no boardId is provided', () => {
    const mockUser = { uid: 'u1', getIdToken: mockGetIdToken } as unknown as AuthContextValue['user'];
    const { result } = renderHook(() => useSocket(undefined), {
      wrapper: createWrapper(mockUser),
    });

    expect(result.current.status).toBe('disconnected');
  });

  // Note: VITE_SOCKET_SERVER_URL is captured at module load time as a const.
  // Testing the "no URL" case would require a separate module reimport.
  // The logic is tested indirectly: canConnect = Boolean(user && boardId && SOCKET_URL).

  it('starts with connecting status when user, boardId, and URL are present', async () => {
    const mockUser = { uid: 'u1', getIdToken: mockGetIdToken } as unknown as AuthContextValue['user'];

    const { result } = renderHook(() => useSocket('board-1'), {
      wrapper: createWrapper(mockUser),
    });

    // Initially should be connecting (before async token fetch completes)
    expect(result.current.status).toBe('connecting');
  });

  it('calls disconnect on unmount', async () => {
    const mockUser = { uid: 'u1', getIdToken: mockGetIdToken } as unknown as AuthContextValue['user'];

    const { unmount } = renderHook(() => useSocket('board-1'), {
      wrapper: createWrapper(mockUser),
    });

    // Wait for async connection setup
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    unmount();

    // Socket should have been cleaned up
    expect(mockSocket.removeAllListeners).toHaveBeenCalled();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('registers connect and disconnect event handlers', async () => {
    const mockUser = { uid: 'u1', getIdToken: mockGetIdToken } as unknown as AuthContextValue['user'];

    renderHook(() => useSocket('board-1'), {
      wrapper: createWrapper(mockUser),
    });

    // Wait for async token fetch
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const eventNames = mockSocket.on.mock.calls.map((c: unknown[]) => c[0]);
    expect(eventNames).toContain('connect');
    expect(eventNames).toContain('disconnect');
    expect(eventNames).toContain('connect_error');
  });
});
