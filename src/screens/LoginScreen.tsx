import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { AuthError } from '../services/authService';

/**
 * LoginScreen Component
 *
 * Professional login interface for Safari Ops Mobile App.
 * Uses existing Supabase authentication - no account creation needed.
 *
 * Features:
 * - Email and password inputs with validation
 * - Show/hide password toggle
 * - Loading states during authentication
 * - Error handling with user-friendly messages
 * - Responsive layout for all screen sizes
 * - Keyboard-aware scrolling
 */

export default function LoginScreen() {
  const { signIn, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate form inputs
  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    // Email validation
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle login submission
  const handleLogin = async () => {
    console.log('[LoginScreen] Login attempt for:', email);

    // Clear previous errors
    setErrors({});

    // Validate inputs
    if (!validateForm()) {
      console.log('[LoginScreen] Validation failed');
      return;
    }

    setIsSubmitting(true);

    try {
      await signIn(email.trim(), password);
      console.log('[LoginScreen] Login successful');
      // Navigation handled by App.tsx based on auth state
    } catch (error: any) {
      console.error('[LoginScreen] Login failed:', error);

      const authError = error as AuthError;

      // Handle specific error cases
      if (authError.code === 'ROLE_NOT_ALLOWED') {
        setErrors({
          general: authError.message,
        });
      } else if (authError.message.includes('Invalid login credentials')) {
        setErrors({
          general: 'Invalid email or password. Please try again.',
        });
      } else if (authError.message.includes('Email not confirmed')) {
        setErrors({
          general: 'Please verify your email address before logging in.',
        });
      } else {
        setErrors({
          general: authError.message || 'Login failed. Please try again.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle forgot password
  const handleForgotPassword = () => {
    Alert.alert(
      'Reset Password',
      'Please contact your administrator to reset your password.',
      [{ text: 'OK' }]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo/Brand Section */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/jackal-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Login Form */}
        <View style={styles.form}>
          {/* General Error Message */}
          {errors.general && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errors.general}</Text>
            </View>
          )}

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="your.email@example.com"
              placeholderTextColor="#999"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setErrors((prev) => ({ ...prev, email: undefined, general: undefined }));
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!isSubmitting}
            />
            {errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.passwordInput, errors.password && styles.inputError]}
                placeholder="Enter your password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrors((prev) => ({ ...prev, password: undefined, general: undefined }));
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
              />
              <TouchableOpacity
                style={styles.showPasswordButton}
                onPress={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
              >
                <Text style={styles.showPasswordText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
          </View>

          {/* Forgot Password Link */}
          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={handleForgotPassword}
            disabled={isSubmitting}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, isSubmitting && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isSubmitting || loading}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Use your existing Jackal Wild Adventures credentials
          </Text>
          <Text style={styles.footerSubtext}>
            Only administrators and staff can access the mobile app
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  errorContainer: {
    backgroundColor: '#fee',
    borderLeftWidth: 4,
    borderLeftColor: '#c00',
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
  },
  errorText: {
    color: '#c00',
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#c00',
  },
  fieldError: {
    color: '#c00',
    fontSize: 12,
    marginTop: 4,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  showPasswordButton: {
    position: 'absolute',
    right: 12,
    padding: 8,
  },
  showPasswordText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#007AFF',
    fontSize: 14,
  },
  loginButton: {
    height: 48,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
