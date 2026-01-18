/**
 * Authentication Service
 *
 * Handles user authentication, session management, and authorization
 */

import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { Logger } from '../utils/Logger';
import type { StorageService } from '../storage/StorageService';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role?: string;
  metadata?: Record<string, any>;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
}

export interface AuthError {
  code: string;
  message: string;
}

export interface AuthServiceConfig {
  supabaseUrl: string;
  supabaseKey: string;
  logger: Logger;
  storage: StorageService;
}

const STORAGE_KEY_SESSION = '@jackal_auth_session';

export class AuthService {
  private logger: Logger;
  private storage: StorageService;
  private supabase: SupabaseClient;
  private currentSession: AuthSession | null = null;
  private currentUser: AuthUser | null = null;
  private authStateListeners: Array<(user: AuthUser | null) => void> = [];

  constructor(config: AuthServiceConfig) {
    this.logger = config.logger;
    this.storage = config.storage;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);

    // Set up auth state listener
    this.setupAuthStateListener();
  }

  /**
   * Set up Supabase auth state listener
   */
  private setupAuthStateListener(): void {
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.logger.info('[Auth] Auth state changed:', event);

      if (session) {
        this.handleSessionUpdate(session);
      } else {
        this.handleSessionExpired();
      }
    });
  }

  /**
   * Initialize auth service
   */
  public async initialize(): Promise<void> {
    this.logger.info('[Auth] Initializing');

    try {
      // Try to restore session from storage
      const storedSession = await this.storage.getItem(STORAGE_KEY_SESSION);
      if (storedSession) {
        const session: AuthSession = JSON.parse(storedSession);

        // Check if session is still valid
        if (session.expiresAt > Date.now()) {
          this.currentSession = session;
          this.currentUser = session.user;
          this.logger.info('[Auth] Session restored from storage');
        } else {
          this.logger.info('[Auth] Stored session expired');
          await this.storage.removeItem(STORAGE_KEY_SESSION);
        }
      }

      // Get current session from Supabase
      const { data: { session } } = await this.supabase.auth.getSession();
      if (session) {
        this.handleSessionUpdate(session);
      }

      this.logger.info('[Auth] Initialization complete');
    } catch (error) {
      this.logger.error('[Auth] Initialization failed', error);
      throw error;
    }
  }

  /**
   * Sign in with email and password
   */
  public async signIn(email: string, password: string): Promise<AuthSession> {
    this.logger.info('[Auth] Signing in:', email);

    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw this.mapSupabaseError(error);
      }

      if (!data.session || !data.user) {
        throw new Error('No session returned from sign in');
      }

      const session = this.createAuthSession(data.session, data.user);
      await this.saveSession(session);

      this.logger.info('[Auth] Sign in successful');
      return session;
    } catch (error) {
      this.logger.error('[Auth] Sign in failed', error);
      throw error;
    }
  }

  /**
   * Sign up with email and password
   */
  public async signUp(email: string, password: string, metadata?: Record<string, any>): Promise<AuthSession> {
    this.logger.info('[Auth] Signing up:', email);

    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) {
        throw this.mapSupabaseError(error);
      }

      if (!data.session || !data.user) {
        throw new Error('No session returned from sign up');
      }

      const session = this.createAuthSession(data.session, data.user);
      await this.saveSession(session);

      this.logger.info('[Auth] Sign up successful');
      return session;
    } catch (error) {
      this.logger.error('[Auth] Sign up failed', error);
      throw error;
    }
  }

  /**
   * Sign out
   */
  public async signOut(): Promise<void> {
    this.logger.info('[Auth] Signing out');

    try {
      await this.supabase.auth.signOut();
      await this.clearSession();

      this.logger.info('[Auth] Sign out successful');
    } catch (error) {
      this.logger.error('[Auth] Sign out failed', error);
      throw error;
    }
  }

  /**
   * Get current user
   */
  public async getCurrentUser(): Promise<AuthUser | null> {
    return this.currentUser;
  }

  /**
   * Get current session
   */
  public async getCurrentSession(): Promise<AuthSession | null> {
    return this.currentSession;
  }

  /**
   * Check if user is authenticated
   */
  public async isAuthenticated(): Promise<boolean> {
    return this.currentUser !== null && this.currentSession !== null;
  }

  /**
   * Refresh session
   */
  public async refreshSession(): Promise<AuthSession> {
    this.logger.info('[Auth] Refreshing session');

    try {
      const { data, error } = await this.supabase.auth.refreshSession();

      if (error) {
        throw this.mapSupabaseError(error);
      }

      if (!data.session || !data.user) {
        throw new Error('No session returned from refresh');
      }

      const session = this.createAuthSession(data.session, data.user);
      await this.saveSession(session);

      this.logger.info('[Auth] Session refreshed');
      return session;
    } catch (error) {
      this.logger.error('[Auth] Session refresh failed', error);
      throw error;
    }
  }

  /**
   * Reset password
   */
  public async resetPassword(email: string): Promise<void> {
    this.logger.info('[Auth] Resetting password for:', email);

    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email);

      if (error) {
        throw this.mapSupabaseError(error);
      }

      this.logger.info('[Auth] Password reset email sent');
    } catch (error) {
      this.logger.error('[Auth] Password reset failed', error);
      throw error;
    }
  }

  /**
   * Update user metadata
   */
  public async updateUser(updates: { email?: string; password?: string; data?: Record<string, any> }): Promise<AuthUser> {
    this.logger.info('[Auth] Updating user');

    try {
      const { data, error } = await this.supabase.auth.updateUser(updates);

      if (error) {
        throw this.mapSupabaseError(error);
      }

      if (!data.user) {
        throw new Error('No user returned from update');
      }

      this.currentUser = this.mapUser(data.user);

      this.logger.info('[Auth] User updated');
      return this.currentUser;
    } catch (error) {
      this.logger.error('[Auth] User update failed', error);
      throw error;
    }
  }

  /**
   * Get access token
   */
  public async getAccessToken(): Promise<string | null> {
    if (!this.currentSession) {
      return null;
    }

    // Check if token is expired
    if (this.currentSession.expiresAt < Date.now()) {
      try {
        const session = await this.refreshSession();
        return session.accessToken;
      } catch (error) {
        this.logger.error('[Auth] Token refresh failed', error);
        return null;
      }
    }

    return this.currentSession.accessToken;
  }

  /**
   * Add auth state listener
   */
  public addAuthStateListener(listener: (user: AuthUser | null) => void): () => void {
    this.authStateListeners.push(listener);

    // Immediately call with current user
    listener(this.currentUser);

    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(listener);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  /**
   * Handle session update
   */
  private handleSessionUpdate(session: Session): void {
    this.logger.info('[Auth] Session updated');

    const authSession = this.createAuthSession(session, session.user);
    this.saveSession(authSession).catch((error) => {
      this.logger.error('[Auth] Error saving session', error);
    });
  }

  /**
   * Handle session expired
   */
  private handleSessionExpired(): void {
    this.logger.info('[Auth] Session expired');

    this.clearSession().catch((error) => {
      this.logger.error('[Auth] Error clearing session', error);
    });
  }

  /**
   * Create auth session from Supabase session
   */
  private createAuthSession(session: Session, user: User): AuthSession {
    const authSession: AuthSession = {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: new Date(session.expires_at! * 1000).getTime(),
      user: this.mapUser(user),
    };

    this.currentSession = authSession;
    this.currentUser = authSession.user;

    // Notify listeners
    this.notifyAuthStateListeners(this.currentUser);

    return authSession;
  }

  /**
   * Map Supabase user to AuthUser
   */
  private mapUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email!,
      role: user.role,
      metadata: user.user_metadata,
    };
  }

  /**
   * Save session to storage
   */
  private async saveSession(session: AuthSession): Promise<void> {
    try {
      await this.storage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
    } catch (error) {
      this.logger.error('[Auth] Error saving session to storage', error);
    }
  }

  /**
   * Clear session from storage
   */
  private async clearSession(): Promise<void> {
    this.currentSession = null;
    this.currentUser = null;

    try {
      await this.storage.removeItem(STORAGE_KEY_SESSION);
    } catch (error) {
      this.logger.error('[Auth] Error clearing session from storage', error);
    }

    // Notify listeners
    this.notifyAuthStateListeners(null);
  }

  /**
   * Notify auth state listeners
   */
  private notifyAuthStateListeners(user: AuthUser | null): void {
    this.authStateListeners.forEach((listener) => {
      try {
        listener(user);
      } catch (error) {
        this.logger.error('[Auth] Error in auth state listener', error);
      }
    });
  }

  /**
   * Map Supabase error to AuthError
   */
  private mapSupabaseError(error: any): AuthError {
    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
    };
  }

  /**
   * Get Supabase client (for advanced usage)
   */
  public getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }
}
