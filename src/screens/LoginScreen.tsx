/**
 * LoginScreen — Glassmorphic edition
 *
 * Uses semi-transparent layered Views to achieve the frosted-glass look
 * without expo-blur (which is unsupported in the iOS simulator).
 * The effect is visually identical to BlurView on real devices.
 *
 * Background: assets/safari/jackal-brand-fleet.jpg (Jackal Adventures fleet — branded spare-tyre covers)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Alert,
  Animated,
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { saveCredentials, loadCredentials } from '../lib/secureCredentials';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Brand palette ────────────────────────────────────────────────────────────
const GOLD   = '#c8922a';
const GOLD_L = '#e8b84b';
const BROWN  = '#3d2b0a';

type LoginScreenMode = 'login' | 'unlock';
interface LoginScreenProps { mode?: LoginScreenMode; }

// ─── Glass panel (no BlurView — pure layered transparency) ───────────────────
function GlassPanel({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[gp.outer, style]}>
      {/* Frosted wash — deeper opacity gives the frosted look without blur */}
      <View style={gp.wash} />
      {/* Subtle inner highlights to simulate refraction */}
      <View style={gp.topEdge} />
      <View style={gp.leftEdge} />
      {/* Content */}
      <View style={gp.content}>{children}</View>
    </View>
  );
}
const gp = StyleSheet.create({
  outer:   {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.38)',
  },
  wash:    {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12,8,2,0.72)',
  },
  topEdge: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  leftEdge: {
    position: 'absolute', top: 1.5, left: 0, bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  content: {},
});

// ─── Glass input ──────────────────────────────────────────────────────────────
function GlassInput({
  label, value, onChange, placeholder, secure, keyboardType,
  onFocus, onBlur, focused, error, returnKeyType, onSubmit, right,
}: {
  label: string; value: string; onChange: (t: string) => void;
  placeholder: string; secure?: boolean; keyboardType?: any;
  onFocus?: () => void; onBlur?: () => void; focused?: boolean;
  error?: string; returnKeyType?: any; onSubmit?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={gi.group}>
      <Text style={gi.label}>{label}</Text>
      <View style={[gi.wrap, focused && gi.wrapFocus, !!error && gi.wrapErr]}>
        {/* Input field background wash */}
        <View style={[gi.washInner, focused && { backgroundColor: 'rgba(255,255,255,0.14)' }]} />
        {/* Gold focus accent line */}
        {focused && <View style={gi.focusEdge} />}
        <TextInput
          style={[gi.input, !!right && { flex: 1 }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.38)"
          onFocus={onFocus}
          onBlur={onBlur}
          secureTextEntry={secure}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmit}
        />
        {right}
      </View>
      {!!error && <Text style={gi.errText}>{error}</Text>}
    </View>
  );
}
const gi = StyleSheet.create({
  group:     { marginBottom: 14 },
  label:     { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 7 },
  wrap:      { flexDirection: 'row', alignItems: 'center', minHeight: 50, borderRadius: 14, overflow: 'hidden', borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 16 },
  wrapFocus: { borderColor: GOLD_L, borderWidth: 1.6 },
  wrapErr:   { borderColor: 'rgba(255,100,80,0.7)' },
  washInner: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.06)' } as any,
  focusEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: GOLD_L + '99' },
  input:     { color: '#ffffff', fontSize: 15, fontWeight: '500', paddingVertical: 12 },
  errText:   { marginTop: 5, color: '#ff9580', fontSize: 12, fontWeight: '500' },
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginScreen({ mode = 'login' }: LoginScreenProps) {
  const { signIn, loading } = useAuth();
  const {
    biometricAvailable,
    biometricEnabled,
    biometricLabel,
    setBiometricEnabled,
    authenticateWithBiometrics,
  } = useAppPreferences();

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused,  setPassFocused]  = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors]             = useState<{ email?: string; password?: string; general?: string }>({});

  // ── Entrance animations ──────────────────────────────────────────────────────
  const bgScale   = useRef(new Animated.Value(1.06)).current;
  const logoOp    = useRef(new Animated.Value(0)).current;
  const logoY     = useRef(new Animated.Value(-24)).current;
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const cardOp    = useRef(new Animated.Value(0)).current;
  const cardY     = useRef(new Animated.Value(44)).current;
  const footerOp  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(bgScale, { toValue: 1, duration: 1600, useNativeDriver: true }).start();

    Animated.parallel([
      Animated.spring(logoY,     { toValue: 0, tension: 90, friction: 9, delay: 120, useNativeDriver: true }),
      Animated.timing(logoOp,    { toValue: 1, duration: 550, delay: 80,  useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, tension: 100, friction: 8, delay: 120, useNativeDriver: true }),
    ]).start();

    Animated.parallel([
      Animated.timing(cardOp, { toValue: 1, duration: 600, delay: 300, useNativeDriver: true }),
      Animated.spring(cardY,  { toValue: 0, tension: 70, friction: 11, delay: 300, useNativeDriver: true } as any),
    ]).start();

    Animated.timing(footerOp, { toValue: 1, duration: 700, delay: 650, useNativeDriver: true }).start();
  }, []);

  // ── WhatsApp-style auto biometric sign-in ────────────────────────────────────
  // When Face ID is enabled: load saved credentials, fill fields, then
  // automatically fire the Face ID prompt. On success, sign in immediately
  // — no button press required.
  const triggerBiometricLogin = useCallback(async () => {
    const saved = await loadCredentials();
    if (!saved) return; // no stored creds — fall through to manual form

    // Pre-populate fields so user sees their identity (same as WhatsApp)
    setEmail(saved.email);
    setPassword(saved.password);

    setIsSubmitting(true);
    try {
      const ok = await authenticateWithBiometrics();
      if (!ok) {
        // User cancelled or failed — leave fields filled so they can tap Sign In
        setIsSubmitting(false);
        return;
      }
      // Biometric passed → sign in silently
      await signIn(saved.email, saved.password);
      // AuthContext sets isAuthenticated → navigator redirects automatically
    } catch (error: unknown) {
      const ae = error as AuthError;
      setErrors({ general: ae.message || 'Sign in failed. Please try again.' });
      setIsSubmitting(false);
    }
  }, [authenticateWithBiometrics, signIn]);

  // Fire automatically on mount when biometrics are enabled
  useEffect(() => {
    if (biometricEnabled && biometricAvailable) {
      // Small delay so the entrance animation has started before the system prompt
      const t = setTimeout(() => { void triggerBiometricLogin(); }, 600);
      return () => clearTimeout(t);
    }
  }, []); // intentionally runs once on mount only

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

  // ── Password sign-in ─────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setErrors({});
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);

      if (biometricAvailable && !biometricEnabled) {
        // First-time: offer to enable Face ID
        Alert.alert(
          `Enable ${biometricLabel}`,
          `Use ${biometricLabel} to sign in instantly next time — no password needed.`,
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Enable',
              onPress: () => {
                void setBiometricEnabled(true);
                // Save credentials so auto-login can use them
                void saveCredentials(email.trim(), password);
              },
            },
          ]
        );
      } else if (biometricEnabled) {
        // Refresh stored credentials in case the password changed
        void saveCredentials(email.trim(), password);
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
    Alert.alert('Reset Password', 'Please contact your system administrator to reset your password.', [{ text: 'OK' }]);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>

      {/* ── Full-bleed background — Jackal Adventures vehicle with jackal logo ─ */}
      <Animated.Image
        source={require('../../assets/safari/jackal-vehicle-logo.jpg')}
        style={[s.bgImage, { transform: [{ scale: bgScale }] }]}
        resizeMode="cover"
      />

      {/* Layered overlays — warm sandy tones with strong contrast for glass card */}
      <View style={s.ovTop}    />
      <View style={s.ovMid}    />
      <View style={s.ovBottom} />
      <View style={s.ovWarm}   />

      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Outer column: body (flex 1) + footer pinned at bottom */}
          <View style={s.outer}>

            {/* ── Body: logo + card, vertically centred ───────────────────── */}
            <View style={s.body}>

              {/* Logo */}
              <Animated.View style={[s.logoWrap, { opacity: logoOp, transform: [{ translateY: logoY }, { scale: logoScale }] }]}>
                <View style={s.halo} />
                <View style={s.logoShell}>
                  <Image
                    source={require('../../assets/branding/jackal-logo.png')}
                    style={s.logo}
                    resizeMode="contain"
                  />
                </View>
              </Animated.View>

              {/* Glass form card */}
              <Animated.View style={[s.cardWrap, { opacity: cardOp, transform: [{ translateY: cardY }] }]}>
                <GlassPanel style={s.card}>
                  <View style={s.cardInner}>

                    <Text style={s.cardTitle}>
                      {mode === 'unlock' ? 'Unlock Account' : 'Welcome Back'}
                    </Text>
                    <Text style={s.cardSub}>
                      {mode === 'unlock'
                        ? 'Re-enter your credentials to continue'
                        : 'Sign in to Jackal Adventures Africa'}
                    </Text>

                    {/* Gold rule */}
                    <View style={s.rule}>
                      <View style={s.ruleLine} />
                      <View style={s.ruleDot}  />
                      <View style={s.ruleLine} />
                    </View>

                    {/* Error banner */}
                    {errors.general ? (
                      <View style={s.errBanner}>
                        <View style={s.errBannerWash} />
                        <Text style={s.errIcon}>⚠</Text>
                        <Text style={s.errText}>{errors.general}</Text>
                      </View>
                    ) : null}

                    {/* Email */}
                    <GlassInput
                      label="Email Address"
                      value={email}
                      onChange={(t) => { setEmail(t); setErrors(p => ({ ...p, email: undefined, general: undefined })); }}
                      placeholder="you@jackaladventures.com"
                      keyboardType="email-address"
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      focused={emailFocused}
                      error={errors.email}
                      returnKeyType="next"
                    />

                    {/* Password */}
                    <GlassInput
                      label="Password"
                      value={password}
                      onChange={(t) => { setPassword(t); setErrors(p => ({ ...p, password: undefined, general: undefined })); }}
                      placeholder="Enter your password"
                      secure={!showPassword}
                      onFocus={() => setPassFocused(true)}
                      onBlur={() => setPassFocused(false)}
                      focused={passFocused}
                      error={errors.password}
                      returnKeyType="done"
                      onSubmit={handleLogin}
                      right={
                        <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                          <Text style={s.showHide}>{showPassword ? 'Hide' : 'Show'}</Text>
                        </TouchableOpacity>
                      }
                    />

                    {/* Forgot */}
                    <TouchableOpacity onPress={handleForgotPassword} style={s.forgotRow}>
                      <Text style={s.forgotText}>Forgot password?</Text>
                    </TouchableOpacity>

                    {/* Sign In button */}
                    <TouchableOpacity
                      style={[s.btn, (isSubmitting || loading) && s.btnDisabled]}
                      onPress={handleLogin}
                      disabled={isSubmitting || loading}
                      activeOpacity={0.85}
                    >
                      <View style={s.btnHighlight} />
                      {isSubmitting || loading ? (
                        <ActivityIndicator color={GOLD_L} size="small" />
                      ) : (
                        <Text style={s.btnText}>{mode === 'unlock' ? 'Unlock' : 'Sign In'}</Text>
                      )}
                    </TouchableOpacity>

                    {/* Face ID / Biometric quick-unlock button (shown when enabled) */}
                    {biometricEnabled && biometricAvailable && (
                      <TouchableOpacity
                        style={[s.biometricBtn, (isSubmitting || loading) && s.btnDisabled]}
                        onPress={() => { void triggerBiometricLogin(); }}
                        disabled={isSubmitting || loading}
                        activeOpacity={0.8}
                      >
                        <Text style={s.biometricIcon}>
                          {biometricLabel === 'Face ID' ? '🔐' : '👆'}
                        </Text>
                        <Text style={s.biometricText}>Sign in with {biometricLabel}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </GlassPanel>
              </Animated.View>

            </View>{/* /body */}

            {/* ── Footer — always visible, no scrolling required ───────────── */}
            <Animated.View style={[s.footer, { opacity: footerOp }]}>
              <View style={s.footerDivider}>
                <View style={s.footerLine} />
                <View style={s.footerDot}  />
                <View style={s.footerLine} />
              </View>
              <Text style={s.footerText}>Authorised personnel only</Text>
              <Text style={s.footerBrand}>Jackal Adventures Africa</Text>
            </Animated.View>

          </View>{/* /outer */}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#1a1208' },

  bgImage:  { position: 'absolute', top: 0, left: 0, width: SW, height: SH },
  // Overlays tuned for the warm sandy vehicle image:
  // top darkens the bright sky/upper area, mid creates depth behind the logo,
  // bottom ensures the glass card stays legible, warm tints to sandy amber palette
  ovTop:    { position: 'absolute', top: 0, left: 0, right: 0, height: SH * 0.42, backgroundColor: 'rgba(20,12,2,0.22)' },
  ovMid:    { position: 'absolute', top: SH * 0.18, left: 0, right: 0, height: SH * 0.30, backgroundColor: 'rgba(10,6,0,0.18)' },
  ovBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: SH * 0.72, backgroundColor: 'rgba(8,4,0,0.52)' },
  ovWarm:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(40,22,4,0.10)' },

  safe:  { flex: 1, backgroundColor: 'transparent' },
  kav:   { flex: 1 },

  // Outer column: body + footer fill the SafeAreaView (no minHeight hack, no ScrollView)
  outer: {
    flex: 1,
    paddingHorizontal: 22,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },

  // body: logo + card centred in the remaining space above the footer
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },

  // Logo — outer halo ring + inner white shell; enhanced glow for premium feel
  logoWrap:  { alignItems: 'center', justifyContent: 'center', marginBottom: 22, position: 'relative', width: 128, height: 128 },
  // Outer glow ring — wide, warm gold
  halo: {
    position: 'absolute',
    width: 128, height: 128, borderRadius: 64,
    backgroundColor: 'rgba(200,146,42,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(200,146,42,0.38)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
  },
  logoShell: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#ffffff',
    justifyContent: 'center', alignItems: 'center',
    // Deep drop-shadow + gold glow underneath
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 18,
    borderWidth: 2.5,
    borderColor: 'rgba(232,184,75,0.75)',
  },
  logo: { width: 80, height: 80 },

  // Card
  cardWrap:  { width: '100%' },
  card:      { width: '100%' },
  cardInner: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18 },
  cardTitle: {
    fontSize: 22, fontWeight: '800', color: '#ffffff', letterSpacing: -0.3,
    marginBottom: 4, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  cardSub: {
    fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 18,
    marginBottom: 14, textAlign: 'center',
  },

  // Gold rule
  rule:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  ruleLine: { flex: 1, height: 1, backgroundColor: 'rgba(200,146,42,0.35)' },
  ruleDot:  { width: 5, height: 5, borderRadius: 2.5, backgroundColor: GOLD },

  // Error banner
  errBanner:    { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,80,80,0.35)', paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, gap: 10 },
  errBannerWash:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(180,30,30,0.2)' } as any,
  errIcon:      { color: '#ff9580', fontSize: 13, marginTop: 1 },
  errText:      { flex: 1, color: '#ffb5a5', fontSize: 13, lineHeight: 18 },

  showHide:  { color: GOLD_L, fontSize: 13, fontWeight: '700', paddingVertical: 11 },
  forgotRow: { alignSelf: 'center', marginBottom: 18, marginTop: 4 },
  forgotText:{ color: GOLD_L, fontSize: 13, fontWeight: '600' },

  // CTA button
  btn: {
    height: 52, borderRadius: 16, backgroundColor: BROWN,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: GOLD, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.38, shadowRadius: 20, elevation: 12,
    borderWidth: 1.4, borderColor: 'rgba(200,146,42,0.5)',
  },
  btnHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(232,184,75,0.45)' },
  btnDisabled:  { opacity: 0.55 },
  btnText:      { color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 0.8 },

  // Biometric quick-unlock button
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(200,146,42,0.4)',
    backgroundColor: 'rgba(200,146,42,0.08)',
    gap: 8,
  },
  biometricIcon: { fontSize: 20, color: GOLD_L },
  biometricText: { fontSize: 14, fontWeight: '700', color: GOLD_L, letterSpacing: 0.3 },

  // Footer — sits at bottom of outer, always within safe area bounds
  footer:        { alignItems: 'center', paddingBottom: 2 },
  footerDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  footerLine:    { width: 28, height: 1, backgroundColor: 'rgba(200,146,42,0.25)' },
  footerDot:     { width: 4, height: 4, borderRadius: 2, backgroundColor: GOLD + '44' },
  footerText:    { color: 'rgba(255,255,255,0.42)', fontSize: 11, letterSpacing: 0.5 },
  footerBrand:   { color: GOLD + 'bb', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 3 },
});
