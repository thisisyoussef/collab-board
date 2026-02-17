import { useState, useEffect, useCallback, useRef } from 'react';
import {
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

/**
 * Firebase Google Auth hook.
 * Uses signInWithPopup with fallback error handling.
 *
 * signInWithRedirect has a known race condition on Firebase v9+ where
 * onAuthStateChanged fires with null before getRedirectResult resolves,
 * causing the user to see the sign-in page briefly after redirect.
 * signInWithPopup is more reliable — the COOP warning is non-fatal.
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const error = err as { code?: string };
      // If popup blocked, log but don't crash — user can try again
      if (error.code === 'auth/popup-blocked') {
        console.warn('Popup was blocked. Please allow popups for this site.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        // User closed the popup — not an error
      } else {
        console.error('Sign-in failed:', err);
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fbSignOut(auth);
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
  }, []);

  return { user, loading, signIn, signOut };
}
