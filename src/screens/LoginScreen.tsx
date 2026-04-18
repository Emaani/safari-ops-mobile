import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import type { AuthError } from '../services/authService';

// ─── Types ────────────────────────────────────────────────────────────────────
type LoginScreenMode = 'login' | 'unlock';
interface LoginScreenProps {
  mode?: LoginScreenMode;
}

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginScreen({ mode = 'login' }: LoginScreenProps) {
  const { signIn, loading } = useAuth();
  const {
    biometricAvailable,
    biometricEnabled,
    biometricLabel,
    setBiometricEnabled,
  } = useAppPreferences();

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused,  setPassFocused]  = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors]             = useState<{ email?: string; password?: string; general?: string }>({});

  // ── Framer-style staggered entrance ─────────────────────────────────────────
  const logoScale   = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardSlide   = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    // Logo bounces in first
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 120,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Card slides up with 200ms delay
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 550,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.spring(cardSlide, {
        toValue: 0,
        tension: 80,
        friction: 10,
        delay: 200,
        useNativeDriver: true,
      } as any),
    ]).start();
  }, [logoScale, logoOpacity, cardOpacity, cardSlide]);

  // ── Validation ───────────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    const e: typeof errors = {};
    if (!email.trim()) {
      e.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = 'Please enter a valid email address.';
    }
    if (!password) {
      e.password = 'Password is required.';
    } else if (password.length < 6) {
      e.password = 'Password must be at least 6 characters.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Login ────────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setErrors({});
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
      if (biometricAvailable && !biometricEnabled) {
        Alert.alert(
          `Enable ${biometricLabel}`,
          `Use ${biometricLabel} for faster, secure sign-in next time?`,
          [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Enable', onPress: () => { void setBiometricEnabled(true); } },
          ]
        );
      }
    } catch (error: unknown) {
      const ae = error as AuthError;
      if (ae.code === 'ROLE_NOT_ALLOWED') {
        setErrors({ general: ae.message });
      } else if (ae.message?.includes('Invalid login credentials')) {
        setErrors({ general: 'Invalid email or password. Please try again.' });
      } else if (ae.message?.includes('Email not confirmed')) {
        setErrors({ general: 'Please verify your email address before signing in.' });
      } else {
        setErrors({ general: ae.message || 'Sign in failed. Please try again.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Reset Password',
      'Please contact your system administrator to reset your password.',
      [{ text: 'OK' }]
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>

      {/* ── Background image ─────────────────────────────────────────────── */}
      <Image
        source={require('../../assets/safari/fleet-lineup.jpg')}
        style={s.bgImage}
        resizeMode="cover"
      />
      {/* Gradient-effect overlays */}
      <View style={s.ovTop} />
      <View style={s.ovBottom} />

      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView
          style={s.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Logo ───────────────────────────────────────────────────── */}
            <Animated.View
              style={[
                s.logoWrap,
                { opacity: logoOpacity, transform: [{ scale: logoScale }] },
              ]}
            >
              {/* Outer glow ring */}
              <View style={s.logoGlow} />
              {/* Logo shell */}
              <View style={s.logoShell}>
                <Image
                  source={require('../../assets/branding/jackal-logo.png')}
                  style={s.logo}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>

            {/* ── Form card ──────────────────────────────────────────────── */}
            <Animated.View
              style={[
                s.card,
                { opacity: cardOpacity, transform: [{ translateY: cardSlide }] },
              ]}
            >
              {/* Card heading */}
              <Text style={s.cardTitle}>
                {mode === 'unlock' ? 'Unlock Account' : 'Welcome back'}
              </Text>
              <Text style={s.cardSub}>
                {mode === 'unlock'
                  ? 'Re-enter your credentials to continue'
                  : 'Sign in to your account to continue'}
              </Text>

              {/* Error banner */}
              {errors.general ? (
                <View style={s.errBanner}>
                  <Text style={s.errIcon}>⚠</Text>
                  <Text style={s.errText}>{errors.general}</Text>
                </View>
              ) : null}

              {/* Email field */}
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Email Address</Text>
                <View style={[
                  s.inputWrap,
                  emailFocused && s.inputFocused,
                  errors.email && s.inputError,
                ]}>
                  <TextInput
                    style={s.input}
                    placeholder="you@jackaladventures.com"
                    placeholderTextColor="#94a3b8"
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      setErrors(p => ({ ...p, email: undefined, general: undefined }));
                    }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    editable={!isSubmitting}
                    returnKeyType="next"
                  />
                </View>
                {errors.email ? <Text style={s.fieldErr}>{errors.email}</Text> : null}
              </View>

              {/* Password field */}
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Password</Text>
                <View style={[
                  s.inputWrap,
                  s.inputRow,
                  passFocused      && s.inputFocused,
                  errors.password  && s.inputError,
                ]}>
                  <TextInput
                    style={[s.input, s.inputFlex]}
                    placeholder="Enter your password"
                    placeholderTextColor="#94a3b8"
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      setErrors(p => ({ ...p, password: undefined, general: undefined }));
                    }}
                    onFocus={() => setPassFocused(true)}
                    onBlur={() => setPassFocused(false)}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSubmitting}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(v => !v)}
                    disabled={isSubmitting}
                    hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                  >
                    <Text style={s.showHide}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                {errors.password ? <Text style={s.fieldErr}>{errors.password}</Text> : null}
              </View>

              {/* Forgot password */}
              <TouchableOpacity
                onPress={handleForgotPassword}
                disabled={isSubmitting}
                style={s.forgotRow}
              >
                <Text style={s.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              {/* Sign In button */}
              <TouchableOpacity
                style={[s.btn, (isSubmitting || loading) && s.btnDisabled]}
                onPress={handleLogin}
                disabled={isSubmitting || loading}
                activeOpacity={0.88}
              >
                {isSubmitting || loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.btnText}>
                    {mode === 'unlock' ? 'Unlock' : 'Sign In'}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* ── Footer ─────────────────────────────────────────────────── */}
            <Animated.View style={[s.footer, { opacity: cardOpacity }]}>
              <View style={s.footerLine} />
              <Text style={s.footerText}>
                Authorised personnel only · Jackal Adventures Ltd
              </Text>
            </Animated.View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#04080f',
  },

  // Background
  bgImage: {
    position: 'absolute',
    top: 0, left: 0,
    width: SW, height: SH,
  },
  // Subtle dark tint over the top half
  ovTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: SH * 0.5,
    backgroundColor: 'rgba(4,10,20,0.25)',
  },
  // Heavy fade over the bottom half so card pops
  ovBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: SH * 0.72,
    backgroundColor: 'rgba(4,10,22,0.72)',
  },

  safe: { flex: 1, backgroundColor: 'transparent' },
  kav:  { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 44,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  // ── Logo ──────────────────────────────────────────────────────────────────
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    // Needs position relative for the glow ring to sit behind
    position: 'relative',
    width: 136,
    height: 136,
  },
  // Outer ambient glow — a wider, blurred-feeling ring
  logoGlow: {
    position: 'absolute',
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  // Inner solid shell
  logoShell: {
    width: 108,
    height: 108,
    borderRadius: 28,
    backgroundColor: '#ffffff',          // solid white — logo is always visible
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  logo: {
    width: 80,
    height: 80,
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 26,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.38,
    shadowRadius: 44,
    elevation: 18,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 20,
    lineHeight: 18,
  },

  // Error banner
  errBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 16,
    gap: 10,
  },
  errIcon: { color: '#ef4444', fontSize: 13, marginTop: 1 },
  errText: { flex: 1, color: '#dc2626', fontSize: 13, lineHeight: 18 },

  // Fields
  fieldGroup: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  inputWrap: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  inputFocused: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  inputError:   { borderColor: '#ef4444', backgroundColor: '#fff5f5' },
  input:        { color: '#0f172a', fontSize: 15, minHeight: 48 },
  inputFlex:    { flex: 1 },
  showHide:     { color: '#3b82f6', fontSize: 13, fontWeight: '600' },
  fieldErr:     { marginTop: 5, color: '#ef4444', fontSize: 12 },

  // Forgot
  forgotRow: { alignSelf: 'flex-end', marginBottom: 18, marginTop: 4 },
  forgotText: { color: '#3b82f6', fontSize: 13, fontWeight: '600' },

  // Button
  btn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Footer
  footer: { alignItems: 'center', paddingBottom: 4 },
  footerLine: {
    width: 36,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 10,
  },
  footerText: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: 11,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
