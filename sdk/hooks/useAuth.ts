/**
 * useAuth Hook
 *
 * React hook for authentication
 */

import { useState, useEffect, useCallback } from 'react';
import { JackalSDK } from '../core/JackalSDK';
import type { AuthUser, AuthCredentials } from '../auth/AuthService';

export function useAuth() {
  const sdk = JackalSDK.getInstance();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Get initial user
    sdk.auth.getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setIsAuthenticated(currentUser !== null);
      setLoading(false);
    });

    // Listen for auth state changes
    const unsubscribe = sdk.auth.addAuthStateListener((authUser) => {
      setUser(authUser);
      setIsAuthenticated(authUser !== null);
    });

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const session = await sdk.auth.signIn(email, password);
      setUser(session.user);
      setIsAuthenticated(true);
      return session;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await sdk.auth.signOut();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    return await sdk.auth.refreshSession();
  }, []);

  return {
    user,
    loading,
    isAuthenticated,
    signIn,
    signOut,
    refreshSession,
  };
}
