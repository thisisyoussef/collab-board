import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useContext } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthContext';
import { AuthContext } from './auth-context';

const AUTH_INIT_TIMEOUT_MS = 8000;

const mockOnAuthStateChanged = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockFirebaseSignOut = vi.fn();
const mockUnsubscribe = vi.fn();
const mockDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockServerTimestamp = vi.fn(() => 'mock-ts');

let authStateCallback: ((user: unknown) => void) | null = null;
let authStateErrorCallback: ((error: unknown) => void) | null = null;

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signOut: (...args: unknown[]) => mockFirebaseSignOut(...args),
}));

vi.mock('firebase/firestore/lite', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  serverTimestamp: (...args: unknown[]) => mockServerTimestamp(...args),
}));

vi.mock('../lib/firebase', () => ({
  auth: { app: 'auth' },
  db: { app: 'db' },
  googleProvider: { provider: 'google' },
}));

function ContextProbe() {
  const value = useContext(AuthContext);
  if (!value) {
    return <div>No auth context</div>;
  }

  return (
    <div>
      <p>loading:{String(value.loading)}</p>
      <p>error:{value.error || 'none'}</p>
      <p>user:{value.user ? 'present' : 'none'}</p>
      <button onClick={() => void value.signInWithGoogle()}>sign-in</button>
      <button onClick={() => void value.signOut()}>sign-out</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;
    authStateErrorCallback = null;
    mockOnAuthStateChanged.mockImplementation(
      (
        _auth: unknown,
        callback: (user: unknown) => void,
        errorCallback?: (error: unknown) => void,
      ) => {
      authStateCallback = callback;
      authStateErrorCallback = errorCallback ?? null;
      return mockUnsubscribe;
      },
    );
    mockDoc.mockImplementation((_db: unknown, collectionName: string, docId: string) => ({
      id: docId,
      path: `${collectionName}/${docId}`,
    }));
    mockSetDoc.mockResolvedValue(undefined);
    mockSignInWithPopup.mockResolvedValue(undefined);
    mockFirebaseSignOut.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('subscribes to auth state and exposes authenticated user state', async () => {
    render(
      <AuthProvider>
        <ContextProbe />
      </AuthProvider>,
    );

    expect(mockOnAuthStateChanged).toHaveBeenCalledOnce();
    expect(screen.getByText('loading:true')).toBeInTheDocument();

    act(() => {
      authStateCallback?.({ uid: 'user-123' });
    });

    await waitFor(() => {
      expect(screen.getByText('loading:false')).toBeInTheDocument();
    });
    expect(screen.getByText('user:present')).toBeInTheDocument();
  });

  it('maps popup closed auth errors to user-facing copy', async () => {
    mockSignInWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });

    render(
      <AuthProvider>
        <ContextProbe />
      </AuthProvider>,
    );
    act(() => {
      authStateCallback?.(null);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('sign-in'));
    });

    await waitFor(() => {
      expect(screen.getByText('error:Sign-in was cancelled.')).toBeInTheDocument();
    });
  });

  it('maps popup blocked auth errors to user-facing copy', async () => {
    mockSignInWithPopup.mockRejectedValue({ code: 'auth/popup-blocked' });

    render(
      <AuthProvider>
        <ContextProbe />
      </AuthProvider>,
    );
    act(() => {
      authStateCallback?.(null);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('sign-in'));
    });

    await waitFor(() => {
      expect(screen.getByText('error:Popup blocked. Please allow popups and try again.')).toBeInTheDocument();
    });
  });

  it('surfaces sign-out failures', async () => {
    mockFirebaseSignOut.mockRejectedValue(new Error('network'));

    render(
      <AuthProvider>
        <ContextProbe />
      </AuthProvider>,
    );
    act(() => {
      authStateCallback?.({ uid: 'user-123' });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('sign-out'));
    });

    await waitFor(() => {
      expect(screen.getByText('error:Failed to sign out. Please try again.')).toBeInTheDocument();
    });
  });

  it('unlocks loading and surfaces observer errors from auth state subscription', async () => {
    render(
      <AuthProvider>
        <ContextProbe />
      </AuthProvider>,
    );

    act(() => {
      authStateErrorCallback?.({ message: 'storage blocked' });
    });

    await waitFor(() => {
      expect(screen.getByText('loading:false')).toBeInTheDocument();
    });
    expect(
      screen.getByText('error:Authentication failed to initialize. Please reload and try again.'),
    ).toBeInTheDocument();
    expect(screen.getByText('user:none')).toBeInTheDocument();
  });

  it('falls back from loading state if auth initialization stalls', async () => {
    vi.useFakeTimers();

    try {
      render(
        <AuthProvider>
          <ContextProbe />
        </AuthProvider>,
      );

      expect(screen.getByText('loading:true')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(AUTH_INIT_TIMEOUT_MS + 1);
      });

      expect(screen.getByText('loading:false')).toBeInTheDocument();

      expect(
        screen.getByText(
          'error:Authentication is taking longer than expected. You can still sign in with Google.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('user:none')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('recovers if auth state resolves after timeout fallback', async () => {
    vi.useFakeTimers();

    try {
      render(
        <AuthProvider>
          <ContextProbe />
        </AuthProvider>,
      );

      await act(async () => {
        vi.advanceTimersByTime(AUTH_INIT_TIMEOUT_MS + 1);
      });

      expect(screen.getByText('loading:false')).toBeInTheDocument();
      expect(
        screen.getByText(
          'error:Authentication is taking longer than expected. You can still sign in with Google.',
        ),
      ).toBeInTheDocument();

      await act(async () => {
        authStateCallback?.({ uid: 'late-user-123' });
      });

      expect(screen.getByText('user:present')).toBeInTheDocument();
      expect(screen.getByText('error:none')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('unsubscribes from auth listener on unmount', () => {
    const { unmount } = render(
      <AuthProvider>
        <ContextProbe />
      </AuthProvider>,
    );

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });
});
