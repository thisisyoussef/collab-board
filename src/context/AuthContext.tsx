import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { auth, googleProvider } from '../lib/firebase';
import { logger } from '../lib/logger';
import { AuthContext, type AuthContextValue } from './auth-context';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        logger.info('AUTH', `User authenticated: '${firebaseUser.displayName || firebaseUser.email}' (${firebaseUser.uid})`, {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
        });
      } else if (!loading) {
        // Only log sign-out after initial load (not on first page load when user is null)
        logger.info('AUTH', 'User signed out');
      }
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

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
