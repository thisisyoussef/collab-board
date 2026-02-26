import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore/lite';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { auth, db, googleProvider } from '../lib/firebase';
import { logger } from '../lib/logger';
import { AuthContext, type AuthContextValue } from './auth-context';

interface AuthProviderProps {
  children: ReactNode;
}

const AUTH_INIT_TIMEOUT_MS = 8000;
const AUTH_INIT_TIMEOUT_MESSAGE =
  'Authentication is taking longer than expected. You can still sign in with Google.';

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasResolvedInitialAuthStateRef = useRef(false);

  const syncUserProfile = useCallback(async (firebaseUser: User) => {
    const normalizedDisplayName =
      firebaseUser.displayName?.trim() || firebaseUser.email?.trim() || null;

    try {
      await setDoc(
        doc(db, 'users', firebaseUser.uid),
        {
          uid: firebaseUser.uid,
          displayName: normalizedDisplayName,
          email: firebaseUser.email || null,
          photoURL: firebaseUser.photoURL || null,
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err) {
      logger.warn('AUTH', 'Unable to sync user profile document', {
        uid: firebaseUser.uid,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, []);

  useEffect(() => {
    const timeoutId = globalThis.setTimeout(() => {
      if (hasResolvedInitialAuthStateRef.current) {
        return;
      }
      logger.warn('AUTH', `Auth state check exceeded ${AUTH_INIT_TIMEOUT_MS}ms; showing sign-in fallback`);
      setLoading(false);
      setError((current) => current ?? AUTH_INIT_TIMEOUT_MESSAGE);
    }, AUTH_INIT_TIMEOUT_MS);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const isInitialResolution = !hasResolvedInitialAuthStateRef.current;
      if (isInitialResolution) {
        hasResolvedInitialAuthStateRef.current = true;
      }
      globalThis.clearTimeout(timeoutId);

      if (isInitialResolution) {
        setError((current) => (current === AUTH_INIT_TIMEOUT_MESSAGE ? null : current));
      }

      if (firebaseUser) {
        logger.info('AUTH', `User authenticated: '${firebaseUser.displayName || firebaseUser.email}' (${firebaseUser.uid})`, {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
        });
        void syncUserProfile(firebaseUser);
      } else if (!isInitialResolution) {
        // Only log sign-out after initial load (not on first page load when user is null)
        logger.info('AUTH', 'User signed out');
      }
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => {
      globalThis.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [syncUserProfile]);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    logger.info('AUTH', 'Google Sign-In initiated');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      logger.info('AUTH', `Google Sign-In successful for '${result.user.email}'`, {
        uid: result.user.uid,
        email: result.user.email,
      });
    } catch (err: unknown) {
      const maybeFirebaseError = err as { code?: string; message?: string };
      // Surface common popup issues with actionable copy instead of generic failures.
      if (maybeFirebaseError.code === 'auth/popup-closed-by-user') {
        logger.warn('AUTH', 'Sign-in cancelled by user (popup closed)');
        setError('Sign-in was cancelled.');
        return;
      }
      if (maybeFirebaseError.code === 'auth/popup-blocked') {
        logger.warn('AUTH', 'Sign-in popup blocked by browser');
        setError('Popup blocked. Please allow popups and try again.');
        return;
      }
      logger.error('AUTH', `Sign-in failed: ${maybeFirebaseError.message || 'Unknown error'}`, {
        code: maybeFirebaseError.code,
      });
      setError('Failed to sign in. Check Firebase config and authorized domains.');
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await firebaseSignOut(auth);
      logger.info('AUTH', 'User signed out successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('AUTH', `Sign-out failed: ${message}`);
      setError('Failed to sign out. Please try again.');
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, error, signInWithGoogle, signOut }),
    [user, loading, error, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
