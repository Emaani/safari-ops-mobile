import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
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

export default function MoreScreen() {
  const { user, signOut } = useAuth();
  const {
    theme,
    isRTL,
    t,
    language,
    setLanguage,
    themeMode,
    setThemeMode,
    biometricEnabled,
    setBiometricEnabled,
    biometricAvailable,
    biometricLabel,
  } = useAppPreferences();
  const styles = useMemo(() => createStyles(theme, isRTL), [theme, isRTL]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const roleLabel = language === 'ar' ? 'إدارة التطبيق' : 'Operations Access';
  const themeOptions = [
    { label: t('common.darkMode'), value: 'dark' },
    { label: t('common.lightMode'), value: 'light' },
  ];
  const languageOptions: { label: string; value: AppLanguage }[] = [
    { label: 'English', value: 'en' },
    { label: 'العربية', value: 'ar' },
  ];
  const quickActions = [
    language === 'ar' ? 'إنشاء حجز جديد' : 'Create New Booking',
    language === 'ar' ? 'إضافة مركبة' : 'Add Vehicle',
    language === 'ar' ? 'إنشاء طلب صرف' : 'Submit Cash Requisition',
    language === 'ar' ? 'إعداد تقرير' : 'Generate Report',
  ];

  const handleLogout = () => {
    Alert.alert(
      t('common.logout'),
      language === 'ar'
        ? 'هل تريد تسجيل الخروج من التطبيق؟'
        : 'Are you sure you want to sign out?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.logout'),
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);

            try {
              await signOut();
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.message || 'Failed to sign out. Please try again.'
              );
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const handleToggleBiometrics = () => {
    if (!biometricAvailable && !biometricEnabled) {
      Alert.alert(t('common.biometric'), t('biometric.unavailable'));
      return;
    }

    void setBiometricEnabled(!biometricEnabled);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.email?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <Text style={styles.heroTitle}>{user?.email || 'unknown@jackaladventures.com'}</Text>
          <Text style={styles.heroSubtitle}>{roleLabel}</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('common.settings')}</Text>

          <View style={styles.preferenceBlock}>
            <View style={styles.preferenceHeader}>
              <Text style={styles.preferenceTitle}>{t('common.theme')}</Text>
              <Text style={styles.preferenceDescription}>{t('more.themeDescription')}</Text>
            </View>
            <SegmentedControl
              options={themeOptions}
              value={themeMode}
              onChange={(value) => {
                void setThemeMode(value as 'light' | 'dark');
              }}
            />
          </View>

          <View style={styles.preferenceBlock}>
            <View style={styles.preferenceHeader}>
              <Text style={styles.preferenceTitle}>{t('common.language')}</Text>
              <Text style={styles.preferenceDescription}>{t('more.languageDescription')}</Text>
            </View>
            <SegmentedControl
              options={languageOptions}
              value={language}
              onChange={(value) => {
                void setLanguage(value as AppLanguage);
              }}
            />
          </View>

          <TouchableOpacity style={styles.preferenceRow} onPress={handleToggleBiometrics}>
            <View style={styles.preferenceHeader}>
              <Text style={styles.preferenceTitle}>{t('common.biometric')}</Text>
              <Text style={styles.preferenceDescription}>
                {t('more.biometricDescription')}
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: biometricEnabled
                    ? theme.colors.successSoft
                    : theme.colors.surfaceMuted,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  {
                    color: biometricEnabled
                      ? theme.colors.success
                      : theme.colors.textMuted,
                  },
                ]}
              >
                {biometricEnabled
                  ? `${t('common.enabled')} · ${biometricLabel}`
                  : t('common.disabled')}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('common.profile')}</Text>
          <TouchableOpacity style={styles.menuRow}>
            <Text style={styles.menuRowText}>{t('more.account')}</Text>
            <Text style={styles.menuArrow}>{isRTL ? '‹' : '›'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow}>
            <Text style={styles.menuRowText}>{t('more.changePassword')}</Text>
            <Text style={styles.menuArrow}>{isRTL ? '‹' : '›'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('more.quickActions')}</Text>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action}
              style={styles.menuRow}
              onPress={() => {
                Alert.alert(t('more.quickActions'), t('common.functionalSoon'));
              }}
            >
              <Text style={styles.menuRowText}>{action}</Text>
              <Text style={styles.menuArrow}>{isRTL ? '‹' : '›'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('more.appInformation')}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('more.version')}</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('more.lastSync')}</Text>
            <Text style={styles.infoValue}>{t('more.justNow')}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <ActivityIndicator color={theme.colors.accentContrast} />
          ) : (
            <Text style={styles.logoutButtonText}>{t('common.logout')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
    scrollContent: {
      padding: 20,
      paddingBottom: 120,
      gap: 16,
    },
    heroCard: {
      backgroundColor: theme.colors.hero,
      borderRadius: 28,
      padding: 24,
      alignItems: isRTL ? 'flex-end' : 'flex-start',
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    avatarText: {
      color: theme.colors.accentContrast,
      fontSize: 28,
      fontWeight: '800',
    },
    heroTitle: {
      color: theme.colors.accentContrast,
      fontSize: 22,
      fontWeight: '800',
      textAlign: isRTL ? 'right' : 'left',
      marginBottom: 6,
    },
    heroSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 14,
      textAlign: isRTL ? 'right' : 'left',
    },
    sectionCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 18,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: theme.dark ? 0.26 : 0.08,
      shadowRadius: 22,
      elevation: 4,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      textAlign: isRTL ? 'right' : 'left',
      marginBottom: 16,
    },
    preferenceBlock: {
      marginBottom: 18,
      gap: 12,
    },
    preferenceRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    preferenceHeader: {
      flex: 1,
    },
    preferenceTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '700',
      textAlign: isRTL ? 'right' : 'left',
      marginBottom: 4,
    },
    preferenceDescription: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      textAlign: isRTL ? 'right' : 'left',
    },
    statusPill: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 9,
      maxWidth: '46%',
    },
    statusPillText: {
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    menuRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    menuRowText: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '600',
      textAlign: isRTL ? 'right' : 'left',
      flex: 1,
    },
    menuArrow: {
      color: theme.colors.textSoft,
      fontSize: 24,
      lineHeight: 24,
      marginLeft: isRTL ? 0 : 12,
      marginRight: isRTL ? 12 : 0,
    },
    infoRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    infoLabel: {
      color: theme.colors.textMuted,
      fontSize: 14,
    },
    infoValue: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    logoutButton: {
      minHeight: 56,
      borderRadius: 18,
      backgroundColor: theme.colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    logoutButtonDisabled: {
      opacity: 0.7,
    },
    logoutButtonText: {
      color: theme.colors.accentContrast,
      fontSize: 16,
      fontWeight: '800',
    },
  });
}
