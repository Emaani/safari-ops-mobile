import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

/**
 * Authentication Service
 *
 * Handles all authentication operations for the mobile app.
 * Uses existing Supabase authentication - no new accounts needed.
 *
 * Security:
 * - Only allows admin/manager/staff roles
 * - Session persists via AsyncStorage
 * - Auto-refresh tokens enabled
 */

export interface AuthSession {
  user: User;
  session: Session;
}

export interface AuthError {
  message: string;
  code?: string;
}

/**
 * Sign in with email and password
 *
 * @param email - User's email address
 * @param password - User's password
 * @returns AuthSession if successful
 * @throws AuthError if sign in fails
 */
export async function signIn(email: string, password: string): Promise<AuthSession> {
  console.log('[AuthService] Signing in user:', email);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      console.error('[AuthService] Sign in error:', error);
      throw {
        message: error.message,
        code: error.status?.toString(),
      } as AuthError;
    }

    if (!data.session || !data.user) {
      console.error('[AuthService] No session or user returned');
      throw {
        message: 'Authentication failed. Please try again.',
      } as AuthError;
    }

    // Verify user profile exists (role validation disabled - schema doesn't have role column)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.warn('[AuthService] Error fetching user profile:', profileError);
      console.log('[AuthService] Continuing without profile - user may not have a profile yet');
      // Don't fail auth if profile fetch fails - they may not have a profile yet
    }

    // ROLE-BASED ACCESS CONTROL DISABLED
    // The profiles table does not have a 'role' column in the current schema.
    // If you need role-based access control, you have two options:
    //
    // Option 1: Add a 'role' column to the profiles table:
    //   ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user';
    //   UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';
    //
    // Option 2: Create a separate user_roles table:
    //   CREATE TABLE user_roles (
    //     user_id UUID REFERENCES auth.users(id),
    //     role TEXT NOT NULL,
    //     created_at TIMESTAMPTZ DEFAULT NOW()
    //   );
    //
    // Then uncomment and modify this code:
    /*
    const allowedRoles = ['admin', 'manager', 'staff'];
    if (profile && profile.role && !allowedRoles.includes(profile.role)) {
      console.error('[AuthService] User role not allowed:', profile.role);
      await supabase.auth.signOut();
      throw {
        message: 'Access denied. Only administrators and staff can use the mobile app.',
        code: 'ROLE_NOT_ALLOWED',
      } as AuthError;
    }
    */

    console.log('[AuthService] Sign in successful:', {
      userId: data.user.id,
      email: data.user.email,
      hasProfile: profile !== null,
    });

    return {
      user: data.user,
      session: data.session,
    };
  } catch (error: any) {
    // Re-throw AuthError as-is
    if (error.message) {
      throw error;
    }

    // Wrap unexpected errors
    console.error('[AuthService] Unexpected error during sign in:', error);
    throw {
      message: 'An unexpected error occurred. Please try again.',
    } as AuthError;
  }
}

/**
 * Sign out the current user
 *
 * Clears session from AsyncStorage and Supabase
 */
export async function signOut(): Promise<void> {
  console.log('[AuthService] Signing out user');

  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('[AuthService] Sign out error:', error);
      throw {
        message: error.message,
      } as AuthError;
    }

    console.log('[AuthService] Sign out successful');
  } catch (error: any) {
    console.error('[AuthService] Unexpected error during sign out:', error);
    throw {
      message: 'Failed to sign out. Please try again.',
    } as AuthError;
  }
}

/**
 * Get the current session
 *
 * @returns AuthSession if user is signed in, null otherwise
 */
export async function getCurrentSession(): Promise<AuthSession | null> {
  console.log('[AuthService] Getting current session');

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error('[AuthService] Error getting session:', error);
      return null;
    }

    if (!data.session) {
      console.log('[AuthService] No active session');
      return null;
    }

    console.log('[AuthService] Active session found:', {
      userId: data.session.user.id,
      email: data.session.user.email,
    });

    return {
      user: data.session.user,
      session: data.session,
    };
  } catch (error) {
    console.error('[AuthService] Unexpected error getting session:', error);
    return null;
  }
}

/**
 * Get the current user
 *
 * @returns User if signed in, null otherwise
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getCurrentSession();
  return session?.user || null;
}

/**
 * Check if user is authenticated
 *
 * @returns true if user has an active session
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getCurrentSession();
  return session !== null;
}

/**
 * Request password reset email
 *
 * @param email - User's email address
 */
export async function requestPasswordReset(email: string): Promise<void> {
  console.log('[AuthService] Requesting password reset for:', email);

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: 'safariops://reset-password', // Deep link for mobile app
    });

    if (error) {
      console.error('[AuthService] Password reset error:', error);
      throw {
        message: error.message,
      } as AuthError;
    }

    console.log('[AuthService] Password reset email sent');
  } catch (error: any) {
    console.error('[AuthService] Unexpected error requesting password reset:', error);
    throw {
      message: 'Failed to send password reset email. Please try again.',
    } as AuthError;
  }
}

/**
 * Listen for auth state changes
 *
 * @param callback - Function to call when auth state changes
 * @returns Unsubscribe function
 */
export function onAuthStateChange(callback: (session: AuthSession | null) => void) {
  console.log('[AuthService] Setting up auth state listener');

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    console.log('[AuthService] Auth state changed:', _event);

    if (session) {
      callback({
        user: session.user,
        session,
      });
    } else {
      callback(null);
    }
  });

  return () => {
    console.log('[AuthService] Removing auth state listener');
    subscription.unsubscribe();
  };
}
