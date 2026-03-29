import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';

export function AppLoadingScreen() {
  const { theme, t } = useAppPreferences();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.centered}>
        <View style={[styles.logoCard, { backgroundColor: theme.colors.surface }]}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('app.name')}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {t('common.loading')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

export function BiometricGateScreen({
  title,
  subtitle,
  actionLabel,
  fallbackLabel,
  onAuthenticate,
  onFallback,
}: {
  title: string;
  subtitle: string;
  actionLabel: string;
  fallbackLabel: string;
  onAuthenticate: () => void;
  onFallback: () => void;
}) {
  const { theme } = useAppPreferences();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.centered}>
        <View
          style={[
            styles.biometricCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              shadowColor: theme.colors.shadow,
            },
          ]}
        >
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{subtitle}</Text>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}
            onPress={onAuthenticate}
          >
            <Text style={[styles.primaryButtonText, { color: theme.colors.accentContrast }]}>
              {actionLabel}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={onFallback}>
            <Text style={[styles.secondaryButtonText, { color: theme.colors.textMuted }]}>
              {fallbackLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  centered: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCard: {
    width: 84,
    height: 84,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  biometricCard: {
    width: '100%',
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    borderRadius: 18,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
