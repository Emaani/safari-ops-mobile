# VIBECODE PROMPT: Implement Full Authentication System for Safari Ops Mobile App

## 🎯 OBJECTIVE
Build a complete authentication system that allows **existing administrators** from the web application to login to the mobile app **without re-creating their accounts**. Use Supabase Auth with the existing user database.

---

## 🔐 CRITICAL REQUIREMENTS

### 1. Use Existing User Accounts
- **DO NOT** create new user registration
- Web app administrators already exist in Supabase `auth.users` table
- Mobile app must authenticate using the **same credentials** as web app
- Use Supabase email/password authentication

### 2. Preserve Session Across App Restarts
- Use AsyncStorage to persist auth session
- Auto-login on app restart if session is valid
- Handle token refresh automatically

### 3. Secure Implementation
- Never store passwords in plain text
- Use Supabase built-in authentication (secure by default)
- Validate user permissions (admin/staff role checks)
- Handle auth errors gracefully

---

## 📋 IMPLEMENTATION PLAN

### **Phase 1: Authentication Service**

#### File: `src/services/authService.ts`

Create a comprehensive authentication service with these functions:

```typescript
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_SESSION_KEY = '@safari_ops_auth_session';
const AUTH_USER_KEY = '@safari_ops_auth_user';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
}

/**
 * Sign in with email and password
 * Uses existing Supabase users - NO new account creation
 */
export async function signIn(email: string, password: string): Promise<AuthSession> {
  console.log('[Auth] Signing in...', email);

  // 1. Authenticate with Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: password,
  });

  if (error) {
    console.error('[Auth] Sign in error:', error.message);
    throw new Error(error.message);
  }

  if (!data.session || !data.user) {
    throw new Error('No session returned from Supabase');
  }

  console.log('[Auth] Authenticated successfully:', data.user.email);

  // 2. Fetch user profile from profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, role, avatar_url')
    .eq('id', data.user.id)
    .single();

  if (profileError) {
    console.error('[Auth] Error fetching profile:', profileError);
    throw new Error('Failed to fetch user profile');
  }

  // 3. Verify user is admin or staff
  const allowedRoles = ['admin', 'manager', 'staff', 'administrator'];
  if (!profile.role || !allowedRoles.includes(profile.role.toLowerCase())) {
    await supabase.auth.signOut();
    throw new Error('Access denied. Only administrators can access the mobile app.');
  }

  console.log('[Auth] User role verified:', profile.role);

  // 4. Create auth session object
  const authSession: AuthSession = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at || 0,
    user: {
      id: data.user.id,
      email: data.user.email!,
      full_name: profile.full_name,
      role: profile.role,
      avatar_url: profile.avatar_url,
    },
  };

  // 5. Persist session to AsyncStorage
  await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(authSession));
  await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(authSession.user));

  console.log('[Auth] Session saved to AsyncStorage');

  return authSession;
}

/**
 * Sign out and clear session
 */
export async function signOut(): Promise<void> {
  console.log('[Auth] Signing out...');

  try {
    // 1. Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[Auth] Supabase sign out error:', error);
    }

    // 2. Clear AsyncStorage
    await AsyncStorage.removeItem(AUTH_SESSION_KEY);
    await AsyncStorage.removeItem(AUTH_USER_KEY);

    console.log('[Auth] Signed out successfully');
  } catch (error) {
    console.error('[Auth] Error during sign out:', error);
    throw error;
  }
}

/**
 * Get current session from AsyncStorage
 * Returns null if no session or session expired
 */
export async function getCurrentSession(): Promise<AuthSession | null> {
  console.log('[Auth] Getting current session...');

  try {
    const sessionJson = await AsyncStorage.getItem(AUTH_SESSION_KEY);
    if (!sessionJson) {
      console.log('[Auth] No session found in AsyncStorage');
      return null;
    }

    const session: AuthSession = JSON.parse(sessionJson);

    // Check if session expired
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at < now) {
      console.log('[Auth] Session expired, attempting refresh...');

      // Try to refresh session
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: session.refresh_token,
      });

      if (error || !data.session) {
        console.error('[Auth] Session refresh failed:', error?.message);
        await signOut();
        return null;
      }

      // Update session with new tokens
      session.access_token = data.session.access_token;
      session.refresh_token = data.session.refresh_token;
      session.expires_at = data.session.expires_at || 0;

      await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
      console.log('[Auth] Session refreshed successfully');
    }

    console.log('[Auth] Valid session found:', session.user.email);
    return session;
  } catch (error) {
    console.error('[Auth] Error getting session:', error);
    await signOut();
    return null;
  }
}

/**
 * Get current user from AsyncStorage
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const userJson = await AsyncStorage.getItem(AUTH_USER_KEY);
    if (!userJson) return null;
    return JSON.parse(userJson);
  } catch (error) {
    console.error('[Auth] Error getting current user:', error);
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getCurrentSession();
  return session !== null;
}

/**
 * Validate password reset request
 */
export async function requestPasswordReset(email: string): Promise<void> {
  console.log('[Auth] Requesting password reset for:', email);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'safariops://reset-password',
  });

  if (error) {
    console.error('[Auth] Password reset error:', error);
    throw new Error(error.message);
  }

  console.log('[Auth] Password reset email sent');
}
```

---

### **Phase 2: Authentication Context Provider**

#### File: `src/contexts/AuthContext.tsx`

Create a React Context to manage auth state globally:

```typescript
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { AuthUser, AuthSession, signIn, signOut, getCurrentSession, getCurrentUser } from '../services/authService';

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    console.log('[AuthContext] Checking for existing session...');
    setLoading(true);

    try {
      const existingSession = await getCurrentSession();
      if (existingSession) {
        setSession(existingSession);
        setUser(existingSession.user);
        console.log('[AuthContext] Session restored:', existingSession.user.email);
      } else {
        console.log('[AuthContext] No valid session found');
      }
    } catch (error) {
      console.error('[AuthContext] Error checking session:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(email: string, password: string) {
    console.log('[AuthContext] Attempting sign in...');
    setLoading(true);

    try {
      const newSession = await signIn(email, password);
      setSession(newSession);
      setUser(newSession.user);
      console.log('[AuthContext] Sign in successful');
    } catch (error) {
      console.error('[AuthContext] Sign in failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    console.log('[AuthContext] Signing out...');
    setLoading(true);

    try {
      await signOut();
      setSession(null);
      setUser(null);
      console.log('[AuthContext] Sign out successful');
    } catch (error) {
      console.error('[AuthContext] Sign out failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn: handleSignIn,
        signOut: handleSignOut,
        isAuthenticated: user !== null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

---

### **Phase 3: Login Screen**

#### File: `src/screens/LoginScreen.tsx`

Create a beautiful, professional login screen:

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen() {
  const { signIn, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    // Validation
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      await signIn(email, password);
      // Navigation handled by App.tsx based on auth state
    } catch (error) {
      console.error('[Login] Error:', error);

      let errorMessage = 'Failed to sign in. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      Alert.alert('Login Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>Safari Ops</Text>
          <Text style={styles.subtitle}>Mobile Dashboard</Text>
        </View>

        {/* Login Form */}
        <View style={styles.formContainer}>
          <Text style={styles.title}>Administrator Login</Text>
          <Text style={styles.description}>
            Sign in with your existing Safari Ops credentials
          </Text>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="admin@safariops.com"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!isLoading}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType="password"
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.showPasswordButton}
              >
                <Text style={styles.showPasswordText}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={() => Alert.alert('Password Reset', 'Contact your administrator to reset your password.')}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Safari Ops Central v1.0.0
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  showPasswordButton: {
    paddingHorizontal: 16,
  },
  showPasswordText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  loginButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  forgotPasswordButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 32,
  },
});
```

---

### **Phase 4: Update App.tsx with Auth Navigation**

Update the main App.tsx to handle authentication state:

```typescript
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
// Import other screens...

const Tab = createBottomTabNavigator();

function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#9ca3af',
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      {/* Other tabs */}
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
```

---

### **Phase 5: Update More Tab with Logout**

Add logout functionality to More screen:

```typescript
// In MoreScreen.tsx
import { useAuth } from '../contexts/AuthContext';

export default function MoreScreen() {
  const { user, signOut } = useAuth();

  async function handleLogout() {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  }

  return (
    <View>
      {/* Profile section */}
      <Text>{user?.full_name}</Text>
      <Text>{user?.email}</Text>
      <Text>{user?.role}</Text>

      {/* Logout button */}
      <TouchableOpacity onPress={handleLogout}>
        <Text>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## ✅ TESTING CHECKLIST

### Test with Existing Web Admin Accounts

1. **Get admin credentials from web app**:
   - Email: (existing admin email)
   - Password: (existing admin password)

2. **Test login flow**:
   - [ ] Open mobile app
   - [ ] Shows login screen
   - [ ] Enter valid admin credentials
   - [ ] Successfully logs in
   - [ ] Shows Dashboard

3. **Test session persistence**:
   - [ ] Login successfully
   - [ ] Close app completely
   - [ ] Reopen app
   - [ ] Should auto-login (no login screen)

4. **Test logout**:
   - [ ] Navigate to More tab
   - [ ] Tap Logout
   - [ ] Confirm logout
   - [ ] Returns to login screen

5. **Test invalid credentials**:
   - [ ] Enter wrong email
   - [ ] Shows error message
   - [ ] Enter wrong password
   - [ ] Shows error message

6. **Test non-admin user**:
   - [ ] Try login with non-admin account
   - [ ] Should show "Access denied" error

---

## 🔒 SECURITY CONSIDERATIONS

### Implemented Security Features:

1. **Passwords**: Never stored locally (Supabase handles securely)
2. **Tokens**: Stored in AsyncStorage (encrypted on device)
3. **Auto-refresh**: Session tokens auto-refresh before expiry
4. **Role validation**: Only admin/manager/staff can access
5. **Logout**: Properly clears all session data

### Additional Security (Optional):

```typescript
// Add biometric authentication (Face ID / Touch ID)
import * as LocalAuthentication from 'expo-local-authentication';

async function unlockWithBiometrics() {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Safari Ops',
  });

  if (result.success) {
    // Auto-fill saved credentials or restore session
  }
}
```

---

## 📊 SUCCESS CRITERIA

Authentication is complete when:
- [x] Existing web admins can login without new accounts
- [x] Session persists across app restarts
- [x] Logout clears session completely
- [x] Non-admin users cannot access
- [x] Invalid credentials show errors
- [x] Loading states handled properly
- [x] Auto-refresh works
- [x] Secure token storage
- [x] Beautiful, professional login UI

---

## 🚀 DELIVERABLES

1. `src/services/authService.ts` - Complete auth service
2. `src/contexts/AuthContext.tsx` - Global auth state
3. `src/screens/LoginScreen.tsx` - Professional login UI
4. Updated `App.tsx` - Auth-aware navigation
5. Updated `MoreScreen.tsx` - Logout functionality

---

## 🎯 BUILD NOW

Implement the complete authentication system. Existing web administrators should be able to login immediately without any additional setup!
