/**
 * LoginScreen — Liquid Glass Edition
 *
 * Full-bleed Jackal Adventures vehicle photo with a true native blur
 * (expo-blur BlurView) glassmorphic form card. Light refracts off the
 * card edges while the African landscape remains visible beneath.
 *
 * Background image → assets/safari/jackal-vehicle.jpg
 * Falls back to fleet-lineup.jpg if the new asset isn't present yet.
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
import { BlurView } from 'expo-blur';
import { useAuth } from '../contexts/AuthContext';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import type { AuthError } from '../services/authService';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Brand palette ────────────────────────────────────────────────────────────
const GOLD   = '#c8922a';
const GOLD_L = '#e8b84b';
const BROWN  = '#3d2b0a';
const WHITE  = '#ffffff';

type LoginScreenMode = 'login' | 'unlock';
interface LoginScreenProps { mode?: LoginScreenMode; }

// ─── Liquid-glass helper ──────────────────────────────────────────────────────
// Renders a frosted-glass panel with a top refraction highlight edge
function GlassPanel({
  children, style, intensity = 55,
}: { children: React.ReactNode; style?: object; intensity?: number }) {
  return (
    <View style={[gp.outer, style]}>
      {/* Native platform blur — renders the background through frosted glass */}
      <BlurView
        intensity={intensity}
        tint="systemMaterialLight"
        style={StyleSheet.absoluteFillObject}
      />
      {/* Translucent wash on top of blur */}
      <View style={gp.wash} />
      {/* Top-edge refraction highlight */}
      <View style={gp.topEdge} />
      {/* Left-edge refraction highlight */}
      <View style={gp.leftEdge} />
      {/* Content sits above all layers */}
      <View style={gp.content}>{children}</View>
    </View>
  );
}
const gp = StyleSheet.create({
  outer:   {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.42)',
  },
  wash:    {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  topEdge: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
  },
  leftEdge: {
    position: 'absolute', top: 2, left: 0, bottom: 0,
    width: 1.2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  content: { padding: 0 },
});

// ─── Glass input ──────────────────────────────────────────────────────────────
function GlassInput({
  label, value, onChange, placeholder, secure, keyboardType,
  onFocus, onBlur, focused, error, returnKeyType, onSubmit,
  right,
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
        <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={[gi.washInner, focused && { backgroundColor: 'rgba(255,255,255,0.22)' }]} />
        {focused && <View style={gi.focusEdge} />}
        <TextInput
          style={[gi.input, !!right && { flex: 1 }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.45)"
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
  label:     { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 8 },
  wrap:      { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderRadius: 14, overflow: 'hidden', borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.28)', paddingHorizontal: 16 },
  wrapFocus: { borderColor: GOLD_L, borderWidth: 1.6 },
  wrapErr:   { borderColor: 'rgba(255,100,80,0.75)' },
  washInner: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.08)' } as any,
  focusEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: GOLD_L + 'aa' },
  input:     { color: WHITE, fontSize: 15, fontWeight: '500', paddingVertical: 12 },
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
  const bgScale    = useRef(new Animated.Value(1.08)).current;
  const logoY      = useRef(new Animated.Value(-30)).current;
  const logoOp     = useRef(new Animated.Value(0)).current;
  const logoScale  = useRef(new Animated.Value(0.85)).current;
  const cardOp     = useRef(new Animated.Value(0)).current;
  const cardY      = useRef(new Animated.Value(50)).current;
  const footerOp   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subtle parallax zoom on background
    Animated.timing(bgScale, { toValue: 1, duration: 1800, useNativeDriver: true }).start();

    // Logo drops in
    Animated.parallel([
      Animated.spring(logoY,     { toValue: 0, tension: 90, friction: 9, delay: 150, useNativeDriver: true }),
      Animated.timing(logoOp,    { toValue: 1, duration: 600, delay: 100, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, tension: 100, friction: 8, delay: 150, useNativeDriver: true }),
    ]).start();

    // Card rises with stagger
    Animated.parallel([
      Animated.timing(cardOp, { toValue: 1, duration: 600, delay: 350, useNativeDriver: true }),
      Animated.spring(cardY,  { toValue: 0, tension: 70, friction: 11, delay: 350, useNativeDriver: true } as any),
    ]).start();

    // Footer fades last
    Animated.timing(footerOp, { toValue: 1, duration: 700, delay: 700, useNativeDriver: true }).start();
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

      {/* ── Full-bleed background — Jackal Adventures vehicle photo ────────── */}
      <Animated.Image
        source={require('../../assets/safari/jackal-vehicle.jpg')}
        style={[s.bgImage, { transform: [{ scale: bgScale }] }]}
        resizeMode="cover"
        onError={() => {/* falls back to the style background color */}}
      />

      {/* Layered atmosphere overlays */}
      {/* Sky/top — keep the African sky warm and visible */}
      <View style={s.ovSky} />
      {/* Bottom vignette — darkens just enough for text contrast */}
      <View style={s.ovBottom} />
      {/* Subtle warm colour wash — preserves Jackal earth-tone palette */}
      <View style={s.ovWarm} />

      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ── Brand mark ─────────────────────────────────────────────── */}
            <Animated.View style={[s.brandWrap, { opacity: logoOp, transform: [{ translateY: logoY }, { scale: logoScale }] }]}>
              {/* Outer glow halo */}
              <View style={s.halo} />

              {/* Circular glass logo container */}
              <View style={s.logoRing}>
                <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFillObject} />
                <View style={s.logoRingWash} />
                <View style={s.logoRingHighlight} />
                <Image
                  source={require('../../assets/branding/jackal-logo.png')}
                  style={s.logo}
                  resizeMode="contain"
                />
              </View>

              {/* Brand name below logo */}
              <View style={s.brandTextWrap}>
                <Text style={s.brandName}>JACKAL ADVENTURES</Text>
                <View style={s.brandDivider} />
                <Text style={s.brandRegion}>AFRICA</Text>
              </View>
            </Animated.View>

            {/* ── Liquid Glass form card ──────────────────────────────────── */}
            <Animated.View style={[s.cardWrap, { opacity: cardOp, transform: [{ translateY: cardY }] }]}>
              <GlassPanel style={s.card} intensity={60}>
                <View style={s.cardInner}>

                  {/* Heading */}
                  <Text style={s.cardTitle}>
                    {mode === 'unlock' ? 'Unlock Account' : 'Welcome Back'}
                  </Text>
                  <Text style={s.cardSub}>
                    {mode === 'unlock'
                      ? 'Re-enter your credentials to continue'
                      : 'Sign in to Jackal Adventures Africa'}
                  </Text>

                  {/* Gold accent rule */}
                  <View style={s.titleRule}>
                    <View style={s.titleRuleLine} />
                    <View style={s.titleRuleDot} />
                    <View style={s.titleRuleLine} />
                  </View>

                  {/* Error banner */}
                  {errors.general ? (
                    <View style={s.errBanner}>
                      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
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
                    {/* Button liquid glass inner highlight */}
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

            {/* ── Footer ─────────────────────────────────────────────────── */}
            <Animated.View style={[s.footer, { opacity: footerOp }]}>
              {/* Tiny gold paw/divider */}
              <View style={s.footerDivider}>
                <View style={s.footerLine} />
                <View style={s.footerDot} />
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
  root: {
    flex: 1,
    backgroundColor: '#1a1208',
  },

  // ── Background ──────────────────────────────────────────────────────────────
  bgImage: {
    position: 'absolute',
    top: 0, left: 0,
    width: SW, height: SH,
  },
  // Sky overlay — very subtle, lets African sky breathe
  ovSky: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: SH * 0.45,
    backgroundColor: 'rgba(15,25,10,0.12)',
  },
  // Bottom vignette — enough contrast for the glass card
  ovBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: SH * 0.65,
    backgroundColor: 'rgba(8,16,5,0.52)',
  },
  // Warm earth-tone wash — keeps Jackal hue palette intact
  ovWarm: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(60,35,8,0.08)',
  },

  safe: { flex: 1, backgroundColor: 'transparent' },
  kav:  { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    justifyContent: 'flex-end',
    alignItems: 'center',
    minHeight: SH,
  },

  // ── Brand mark ──────────────────────────────────────────────────────────────
  brandWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  // Outer ambient halo
  halo: {
    position: 'absolute',
    width: 152,
    height: 152,
    borderRadius: 76,
    backgroundColor: 'rgba(200,146,42,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(200,146,42,0.22)',
    top: -10,
  },
  // Glass ring around logo
  logoRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    overflow: 'hidden',
    borderWidth: 1.8,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 20,
  },
  logoRingWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  logoRingHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 2.5,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  logo: { width: 78, height: 78 },

  // Brand text
  brandTextWrap: { alignItems: 'center', marginTop: 16 },
  brandName: {
    fontSize: 16,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: 3.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  brandDivider: {
    width: 32,
    height: 1.5,
    backgroundColor: GOLD,
    marginVertical: 5,
  },
  brandRegion: {
    fontSize: 13,
    fontWeight: '700',
    color: GOLD_L,
    letterSpacing: 5,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // ── Card ────────────────────────────────────────────────────────────────────
  cardWrap: { width: '100%', marginBottom: 16 },
  card: { width: '100%' },
  cardInner: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: -0.4,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cardSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 18,
    marginBottom: 14,
  },
  // Gold + dot divider
  titleRule: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  titleRuleLine: { flex: 1, height: 1, backgroundColor: 'rgba(200,146,42,0.4)' },
  titleRuleDot:  { width: 5, height: 5, borderRadius: 2.5, backgroundColor: GOLD },

  // Error banner
  errBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,80,80,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 16,
    gap: 10,
  },
  errBannerWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(200,40,40,0.18)',
  } as any,
  errIcon: { color: '#ff9580', fontSize: 13, marginTop: 1 },
  errText: { flex: 1, color: '#ffb5a5', fontSize: 13, lineHeight: 18 },

  // Show/hide password
  showHide: { color: GOLD_L, fontSize: 13, fontWeight: '700', paddingVertical: 12 },

  // Forgot
  forgotRow: { alignSelf: 'flex-end', marginBottom: 20, marginTop: 2 },
  forgotText: { color: GOLD_L, fontSize: 13, fontWeight: '600' },

  // CTA button — warm dark brown, glass highlight on top
  btn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: BROWN,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1.4,
    borderColor: 'rgba(200,146,42,0.55)',
  },
  // Top refraction shimmer on button
  btnHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 2,
    backgroundColor: 'rgba(232,184,75,0.5)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer:        { alignItems: 'center', paddingBottom: 4 },
  footerDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  footerLine:    { width: 28, height: 1, backgroundColor: 'rgba(200,146,42,0.28)' },
  footerDot:     { width: 4, height: 4, borderRadius: 2, backgroundColor: GOLD + '55' },
  footerText:    { color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 0.5 },
  footerBrand:   { color: GOLD + 'aa', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 3 },
});
