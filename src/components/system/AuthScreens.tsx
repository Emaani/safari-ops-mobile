import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';

function LoadingDots({ color }: { color: string }) {
  // Two dots only — keeps loading indicator clean beneath the logo
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 220),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 350, useNativeDriver: true }),
          Animated.delay((dots.length - i - 1) * 220),
        ])
      )
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={styles.dotsRow}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: color, opacity: dot, transform: [{ scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
          ]}
        />
      ))}
    </View>
  );
}

export function AppLoadingScreen() {
  const { theme } = useAppPreferences();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.centered}>
        <Image
          source={require('../../../assets/jackal-loader-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <LoadingDots color={theme.colors.accent} />
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
  logo: {
    width: 140,
    height: 140,
    marginBottom: 32,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
