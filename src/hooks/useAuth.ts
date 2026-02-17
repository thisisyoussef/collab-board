import { useState, useEffect, useCallback } from 'react';
import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged, type User } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

/**
 * Firebase Google Auth hook.
 * Per collabboard-architecture rule: Google Sign-In only.
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
