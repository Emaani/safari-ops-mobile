import React, { useMemo, useState } from 'react';
import {
  Alert,
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
import { SegmentedControl } from '../components/system/SegmentedControl';
import { useAuth } from '../contexts/AuthContext';
import {
  type AppLanguage,
  useAppPreferences,
} from '../contexts/AppPreferencesContext';
import type { AuthError } from '../services/authService';

type LoginScreenMode = 'login' | 'unlock';

interface LoginScreenProps {
  mode?: LoginScreenMode;
}

export default function LoginScreen({ mode = 'login' }: LoginScreenProps) {
  const { signIn, loading } = useAuth();
  const {
    theme,
    isRTL,
    t,
    language,
    setLanguage,
    biometricAvailable,
    biometricEnabled,
    biometricLabel,
    setBiometricEnabled,
  } = useAppPreferences();
  const styles = useMemo(() => createStyles(theme, isRTL), [theme, isRTL]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = t('login.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = t('login.invalidEmail');
    }

    if (!password) {
      newErrors.password = t('login.passwordRequired');
    } else if (password.length < 6) {
      newErrors.password = t('login.passwordLength');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    setErrors({});

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await signIn(email.trim(), password);

      if (biometricAvailable && !biometricEnabled) {
        Alert.alert(
          t('login.enableBiometricTitle'),
          t('login.enableBiometricMessage', { label: biometricLabel }),
          [
            {
              text: t('common.cancel'),
              style: 'cancel',
            },
            {
              text: t('common.enabled'),
              onPress: () => {
                void setBiometricEnabled(true);
              },
            },
          ]
        );
      }
    } catch (error: unknown) {
      const authError = error as AuthError;

      if (authError.code === 'ROLE_NOT_ALLOWED') {
        setErrors({ general: authError.message });
      } else if (authError.message.includes('Invalid login credentials')) {
        setErrors({
          general:
            language === 'ar'
              ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
              : 'Invalid email or password. Please try again.',
        });
      } else if (authError.message.includes('Email not confirmed')) {
        setErrors({
          general:
            language === 'ar'
              ? 'يرجى تأكيد بريدك الإلكتروني قبل تسجيل الدخول.'
              : 'Please verify your email address before logging in.',
        });
      } else {
        setErrors({
          general:
            authError.message ||
            (language === 'ar'
              ? 'فشل تسجيل الدخول. حاول مرة أخرى.'
              : 'Login failed. Please try again.'),
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      language === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset Password',
      language === 'ar'
        ? 'يرجى التواصل مع المسؤول لإعادة تعيين كلمة المرور.'
        : 'Please contact your administrator to reset your password.',
      [{ text: 'OK' }]
    );
  };

  const languageOptions: { label: string; value: AppLanguage }[] = [
    { label: 'English', value: 'en' },
    { label: 'العربية', value: 'ar' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.languageWrap}>
              <SegmentedControl
                options={languageOptions}
                value={language}
                onChange={(value) => {
                  void setLanguage(value as AppLanguage);
                }}
                compact
              />
            </View>

            <View style={styles.logoShell}>
              <Image
                source={require('../../assets/branding/jackal-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.title}>
              {mode === 'unlock' ? t('login.usePassword') : t('login.welcome')}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'unlock' ? t('biometric.fallback') : t('login.subtitle')}
            </Text>
          </View>

          <View style={styles.formCard}>
            {errors.general && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errors.general}</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('login.email')}</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                placeholder="name@jackaladventures.com"
                placeholderTextColor={theme.colors.textSoft}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setErrors((prev) => ({ ...prev, email: undefined, general: undefined }));
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!isSubmitting}
                textAlign={isRTL ? 'right' : 'left'}
              />
              {errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('login.password')}</Text>
              <View style={[styles.passwordContainer, errors.password && styles.inputError]}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder={t('login.password')}
                  placeholderTextColor={theme.colors.textSoft}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrors((prev) => ({ ...prev, password: undefined, general: undefined }));
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                  textAlign={isRTL ? 'right' : 'left'}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((current) => !current)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.showPasswordText}>
                    {showPassword ? t('login.hide') : t('login.show')}
                  </Text>
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
            </View>

            <TouchableOpacity onPress={handleForgotPassword} disabled={isSubmitting}>
              <Text style={styles.linkText}>{t('login.forgotPassword')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
              onPress={handleLogin}
              disabled={isSubmitting || loading}
            >
              <Text style={styles.primaryButtonText}>{t('login.signIn')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerCard}>
            <Text style={styles.footerTitle}>{t('app.name')}</Text>
            <Text style={styles.footerText}>{t('login.footer')}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(
  theme: ReturnType<typeof useAppPreferences>['theme'],
  isRTL: boolean
) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    flex: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingBottom: 28,
      justifyContent: 'center',
    },
    header: {
      paddingTop: 16,
      marginBottom: 20,
    },
    languageWrap: {
      alignSelf: isRTL ? 'flex-start' : 'flex-end',
      width: 170,
      marginBottom: 24,
    },
    logoShell: {
      width: 88,
      height: 88,
      borderRadius: 28,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: theme.dark ? 0.28 : 0.1,
      shadowRadius: 24,
      elevation: 8,
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      marginBottom: 18,
    },
    logo: {
      width: 58,
      height: 58,
    },
    title: {
      fontSize: 30,
      fontWeight: '800',
      color: theme.colors.text,
      textAlign: isRTL ? 'right' : 'left',
      letterSpacing: -1,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.textMuted,
      textAlign: isRTL ? 'right' : 'left',
    },
    formCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 20,
      marginBottom: 16,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: theme.dark ? 0.3 : 0.08,
      shadowRadius: 28,
      elevation: 6,
    },
    errorContainer: {
      backgroundColor: theme.colors.dangerSoft,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 16,
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: 13,
      lineHeight: 18,
      textAlign: isRTL ? 'right' : 'left',
    },
    inputGroup: {
      marginBottom: 14,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textMuted,
      marginBottom: 8,
      textAlign: isRTL ? 'right' : 'left',
    },
    input: {
      minHeight: 54,
      borderRadius: 18,
      backgroundColor: theme.colors.input,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 16,
      color: theme.colors.text,
      fontSize: 15,
    },
    inputError: {
      borderColor: theme.colors.danger,
    },
    passwordContainer: {
      minHeight: 54,
      borderRadius: 18,
      backgroundColor: theme.colors.input,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      gap: 12,
    },
    passwordInput: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 15,
      minHeight: 52,
    },
    showPasswordText: {
      color: theme.colors.accent,
      fontSize: 13,
      fontWeight: '700',
    },
    fieldError: {
      marginTop: 6,
      color: theme.colors.danger,
      fontSize: 12,
      textAlign: isRTL ? 'right' : 'left',
    },
    linkText: {
      color: theme.colors.accent,
      fontSize: 13,
      fontWeight: '700',
      textAlign: isRTL ? 'left' : 'right',
      marginBottom: 18,
    },
    primaryButton: {
      minHeight: 56,
      borderRadius: 18,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: theme.colors.accentContrast,
      fontSize: 16,
      fontWeight: '800',
    },
    footerCard: {
      backgroundColor: theme.colors.hero,
      borderRadius: 24,
      padding: 20,
    },
    footerTitle: {
      color: theme.colors.accentContrast,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 8,
      textAlign: isRTL ? 'right' : 'left',
    },
    footerText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
      textAlign: isRTL ? 'right' : 'left',
    },
  });
}
