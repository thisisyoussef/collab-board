import { useState, useEffect, useCallback } from 'react';
import {
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

/**
 * Firebase Google Auth hook.
 * Uses signInWithRedirect (not popup) to avoid Cross-Origin-Opener-Policy
 * issues on Vercel deployments.
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

  // Handle redirect result on page load (after Google redirects back)
  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      console.error('Redirect sign-in failed:', err);
    });
  }, []);

  const signIn = useCallback(async () => {
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      console.error('Sign-in failed:', err);
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
