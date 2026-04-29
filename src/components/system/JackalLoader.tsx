/**
 * JackalLoader — Branded loading component using the Jackal fox head logo.
 * Replaces all ActivityIndicator loaders across the app with a consistent,
 * animated branded experience. Transparent background — works on any colour.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  Image,
  ViewStyle,
} from 'react-native';

const LOGO = require('../../../assets/jackal-loader-logo.png');

interface JackalLoaderProps {
  /** Optional label shown below the logo */
  label?: string;
  /** 'fullscreen' fills parent flex:1 centered | 'overlay' absolute full cover | 'inline' compact centered block */
  variant?: 'fullscreen' | 'overlay' | 'inline';
  /** Background colour for overlay variant. Defaults to semi-transparent dark. */
  overlayColor?: string;
  /** Logo size. Defaults to 90 */
  size?: number;
  style?: ViewStyle;
}

export function JackalLoader({
  label,
  variant = 'fullscreen',
  overlayColor = 'rgba(23, 21, 19, 0.72)',
  size = 90,
  style,
}: JackalLoaderProps) {
  // Pulse: subtle scale breathe
  const pulse = useRef(new Animated.Value(1)).current;
  // Fade: opacity shimmer
  const fade = useRef(new Animated.Value(0.55)).current;
  // Subtle spin on the glow ring
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.00, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(fade, { toValue: 1,    duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0.55, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const inner = (
    <View style={[s.inner, style]}>
      {/* Spinning gold ring behind logo */}
      <Animated.View style={[
        s.ring,
        { width: size + 28, height: size + 28, borderRadius: (size + 28) / 2, transform: [{ rotate }] },
      ]} />
      {/* Pulsing logo */}
      <Animated.View style={{ transform: [{ scale: pulse }], opacity: fade }}>
        <Image
          source={LOGO}
          style={{ width: size, height: size * 0.68, resizeMode: 'contain' }}
        />
      </Animated.View>
      {/* Dot trail */}
      <View style={s.dots}>
        {[0, 1, 2].map(i => (
          <DotBlink key={i} delay={i * 200} />
        ))}
      </View>
      {label ? <Text style={s.label}>{label}</Text> : null}
    </View>
  );

  if (variant === 'overlay') {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor, alignItems: 'center', justifyContent: 'center', zIndex: 999 }]}>
        {inner}
      </View>
    );
  }

  if (variant === 'inline') {
    return (
      <View style={[s.inlineWrap, style]}>
        {inner}
      </View>
    );
  }

  // fullscreen (default)
  return (
    <View style={s.fullscreen}>
      {inner}
    </View>
  );
}

function DotBlink({ delay }: { delay: number }) {
  const op = useRef(new Animated.Value(0.2)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(op, { toValue: 1,   duration: 350, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0.2, duration: 350, useNativeDriver: true }),
        Animated.delay(600 - delay),
      ])
    ).start();
  }, []);
  return <Animated.View style={[s.dot, { opacity: op }]} />;
}

const s = StyleSheet.create({
  fullscreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
  },
  inlineWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#b8883f',
    borderStyle: 'dashed',
    opacity: 0.45,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 18,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#b8883f',
  },
  label: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#b8ab95',
    letterSpacing: 0.3,
  },
});

// ─── Convenience wrappers matching the old API signatures ─────────────────────

/** Drop-in for screens using <LoadingOverlay /> (full-cover absolute overlay) */
export function LoadingOverlay({ label }: { label?: string }) {
  return <JackalLoader variant="overlay" label={label} />;
}

/** Drop-in for screens using <LoadingView label="…" /> (flex centered) */
export function LoadingView({ label }: { label?: string }) {
  return <JackalLoader variant="fullscreen" label={label} />;
}
