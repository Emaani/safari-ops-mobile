/**
 * LoginScreen — Glassmorphic edition
 *
 * Uses semi-transparent layered Views to achieve the frosted-glass look
 * without expo-blur (which is unsupported in the iOS simulator).
 * The effect is visually identical to BlurView on real devices.
 *
 * Background: assets/safari/jackal-brand-fleet.jpg (Jackal Adventures fleet — branded spare-tyre covers)
 */
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
  group:     { marginBottom: 16 },
  label:     { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 8 },
  wrap:      { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderRadius: 14, overflow: 'hidden', borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 16 },
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
  const { biometricAvailable, biometricEnabled, biometricLabel, setBiometricEnabled } = useAppPreferences();

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
    Alert.alert('Reset Password', 'Please contact your system administrator to reset your password.', [{ text: 'OK' }]);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>

      {/* ── Full-bleed background — Jackal Adventures fleet lineup ─────────── */}
      <Animated.Image
        source={require('../../assets/safari/jackal-brand-fleet.jpg')}
        style={[s.bgImage, { transform: [{ scale: bgScale }] }]}
        resizeMode="cover"
      />

      {/* Layered overlays for depth and contrast */}
      <View style={s.ovTop}    />
      <View style={s.ovBottom} />
      <View style={s.ovWarm}   />

      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ── Logo ─────────────────────────────────────────────────────── */}
            <Animated.View style={[s.logoWrap, { opacity: logoOp, transform: [{ translateY: logoY }, { scale: logoScale }] }]}>
              {/* Outer glow halo */}
              <View style={s.halo} />
              {/* Plain white circular shell — no BlurView */}
              <View style={s.logoShell}>
                <Image
                  source={require('../../assets/branding/jackal-logo.png')}
                  style={s.logo}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>

            {/* ── Glass form card ───────────────────────────────────────────── */}
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
                </View>
              </GlassPanel>
            </Animated.View>

            {/* ── Footer ───────────────────────────────────────────────────── */}
            <Animated.View style={[s.footer, { opacity: footerOp }]}>
              <View style={s.footerDivider}>
                <View style={s.footerLine} />
                <View style={s.footerDot}  />
                <View style={s.footerLine} />
              </View>
              <Text style={s.footerText}>Authorised personnel only</Text>
              <Text style={s.footerBrand}>Jackal Adventures Africa</Text>
            </Animated.View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#1a1208' },

  bgImage:  { position: 'absolute', top: 0, left: 0, width: SW, height: SH },
  // Light overlays — let the fleet photo show prominently
  ovTop:    { position: 'absolute', top: 0, left: 0, right: 0, height: SH * 0.35, backgroundColor: 'rgba(0,0,0,0.05)' },
  ovBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: SH * 0.55, backgroundColor: 'rgba(0,0,0,0.38)' },
  ovWarm:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(30,18,4,0.06)' },

  safe:   { flex: 1, backgroundColor: 'transparent' },
  kav:    { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 40,
    justifyContent: 'flex-end',
    alignItems: 'center',
    minHeight: SH,
  },

  // Logo
  logoWrap:  { alignItems: 'center', justifyContent: 'center', marginBottom: 28, position: 'relative', width: 124, height: 124 },
  halo:      { position: 'absolute', width: 124, height: 124, borderRadius: 62, backgroundColor: 'rgba(200,146,42,0.10)', borderWidth: 1, borderColor: 'rgba(200,146,42,0.20)' },
  logoShell: {
    width: 108, height: 108, borderRadius: 54,
    backgroundColor: '#ffffff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 16,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
  },
  logo: { width: 84, height: 84 },

  // Card
  cardWrap: { width: '100%', marginBottom: 18 },
  card:     { width: '100%' },
  cardInner:{ paddingHorizontal: 22, paddingTop: 24, paddingBottom: 22 },
  cardTitle:{ fontSize: 22, fontWeight: '800', color: '#ffffff', letterSpacing: -0.4, marginBottom: 4, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  cardSub:  { fontSize: 13, color: 'rgba(255,255,255,0.62)', lineHeight: 18, marginBottom: 14 },

  // Gold rule
  rule:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  ruleLine: { flex: 1, height: 1, backgroundColor: 'rgba(200,146,42,0.35)' },
  ruleDot:  { width: 5, height: 5, borderRadius: 2.5, backgroundColor: GOLD },

  // Error banner
  errBanner:    { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,80,80,0.35)', paddingHorizontal: 14, paddingVertical: 11, marginBottom: 16, gap: 10 },
  errBannerWash:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(180,30,30,0.2)' } as any,
  errIcon:      { color: '#ff9580', fontSize: 13, marginTop: 1 },
  errText:      { flex: 1, color: '#ffb5a5', fontSize: 13, lineHeight: 18 },

  showHide:  { color: GOLD_L, fontSize: 13, fontWeight: '700', paddingVertical: 12 },
  forgotRow: { alignSelf: 'flex-end', marginBottom: 20, marginTop: 2 },
  forgotText:{ color: GOLD_L, fontSize: 13, fontWeight: '600' },

  // CTA button
  btn: {
    height: 54, borderRadius: 16, backgroundColor: BROWN,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: GOLD, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.38, shadowRadius: 20, elevation: 12,
    borderWidth: 1.4, borderColor: 'rgba(200,146,42,0.5)',
  },
  btnHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(232,184,75,0.45)' },
  btnDisabled:  { opacity: 0.55 },
  btnText:      { color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 0.8 },

  // Footer
  footer:        { alignItems: 'center', paddingBottom: 4 },
  footerDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  footerLine:    { width: 28, height: 1, backgroundColor: 'rgba(200,146,42,0.25)' },
  footerDot:     { width: 4, height: 4, borderRadius: 2, backgroundColor: GOLD + '44' },
  footerText:    { color: 'rgba(255,255,255,0.38)', fontSize: 11, letterSpacing: 0.5 },
  footerBrand:   { color: GOLD + 'aa', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 3 },
});
