import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import {
  signIn as authSignIn,
  signOut as authSignOut,
  getCurrentSession,
  onAuthStateChange,
  AuthSession,
  AuthError,
} from '../services/authService';

/**
 * Authentication Context
 *
 * Provides global authentication state and functions to the entire app.
 * Automatically persists and restores sessions via AsyncStorage.
 */

interface AuthContextType {
  user: User | null;
  session: AuthSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state on mount
  useEffect(() => {
    console.log('[AuthContext] Initializing auth state');

    // Check for existing session
    getCurrentSession()
      .then((currentSession) => {
        if (currentSession) {
          console.log('[AuthContext] Restored session:', currentSession.user.email);
          setUser(currentSession.user);
          setSession(currentSession);
        } else {
          console.log('[AuthContext] No existing session');
        }
      })
      .catch((error) => {
        console.error('[AuthContext] Error restoring session:', error);
      })
      .finally(() => {
        setLoading(false);
      });

    // Listen for auth state changes
    const unsubscribe = onAuthStateChange((authSession) => {
      console.log('[AuthContext] Auth state changed');

      if (authSession) {
        setUser(authSession.user);
        setSession(authSession);
      } else {
        setUser(null);
        setSession(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Sign in function
  const signIn = async (email: string, password: string): Promise<void> => {
    console.log('[AuthContext] Sign in requested for:', email);

    try {
      setLoading(true);

      const authSession = await authSignIn(email, password);

      setUser(authSession.user);
      setSession(authSession);

      console.log('[AuthContext] Sign in successful');
    } catch (error: any) {
      console.error('[AuthContext] Sign in failed:', error);
      throw error as AuthError;
    } finally {
      setLoading(false);
    }
  };

  // Sign out function
  const signOut = async (): Promise<void> => {
    console.log('[AuthContext] Sign out requested');

    try {
      setLoading(true);

      await authSignOut();

      setUser(null);
      setSession(null);

      console.log('[AuthContext] Sign out successful');
    } catch (error: any) {
      console.error('[AuthContext] Sign out failed:', error);
      throw error as AuthError;
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signOut,
    isAuthenticated: user !== null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access authentication context
 *
 * Must be used within AuthProvider
 *
 * @example
 * ```tsx
 * const { user, signIn, signOut, isAuthenticated } = useAuth();
 *
 * if (!isAuthenticated) {
 *   return <LoginScreen />;
 * }
 * ```
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
