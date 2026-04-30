/**
 * JackalLoader — Branded loading component using the Jackal fox head logo.
 * Full gold-tinted fox head, transparent background, works on any colour.
 *
 * Logo asset: assets/jackal-loader-logo.png
 *   - 1022×944 px (ratio 0.924 h/w), gold tinted, transparent background
 *   - Full tribal fox head from ears to chin
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

// Logo natural aspect ratio (h / w) = 944 / 1022 ≈ 0.924
const LOGO_RATIO = 0.924;

// ─── Gold ring colours ────────────────────────────────────────────────────────
const GOLD = '#b8883f';

interface JackalLoaderProps {
  /** Optional status label shown below the animation */
  label?: string;
  /** Layout variant */
  variant?: 'fullscreen' | 'overlay' | 'inline';
  /** Overlay background colour (overlay variant only) */
  overlayColor?: string;
  /** Logo width in px. Height is derived automatically from aspect ratio. Default 110 */
  size?: number;
  style?: ViewStyle;
}

export function JackalLoader({
  label,
  variant = 'fullscreen',
  overlayColor = 'rgba(23, 21, 19, 0.78)',
  size = 110,
  style,
}: JackalLoaderProps) {
  const logoW  = size;
  const logoH  = Math.round(size * LOGO_RATIO);
  // Ring sits behind the logo — sized so it just clears the logo diagonally
  const ringW  = logoW  + 32;
  const ringH  = logoH  + 28;
  const ringRx = Math.min(ringW, ringH) / 2; // pill / oval border-radius

  const pulse = useRef(new Animated.Value(1)).current;
  const glow  = useRef(new Animated.Value(0.35)).current;
  const spin  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Breathe
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.00, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Gold glow shimmer
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.9,  duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.35, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Slow spin on ring
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const inner = (
    <View style={[s.inner, style]}>
      {/* Spinning gold dashed ring — behind logo */}
      <Animated.View
        style={{
          position: 'absolute',
          width:  ringW,
          height: ringH,
          borderRadius: ringRx,
          borderWidth: 1.5,
          borderColor: GOLD,
          borderStyle: 'dashed',
          opacity: 0.5,
          transform: [{ rotate }],
        }}
      />

      {/* Full logo — pulse + glow */}
      <Animated.View
        style={{
          transform: [{ scale: pulse }],
          opacity: glow,
          // Explicit size so React Native never clips or squashes the image
          width: logoW,
          height: logoH,
        }}
      >
        <Image
          source={LOGO}
          style={{ width: logoW, height: logoH }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Dot trail */}
      <View style={s.dots}>
        {[0, 1, 2].map(i => <DotBlink key={i} delay={i * 220} />)}
      </View>

      {label ? <Text style={s.label}>{label}</Text> : null}
    </View>
  );

  if (variant === 'overlay') {
    return (
      <View style={[StyleSheet.absoluteFill, s.overlayWrap, { backgroundColor: overlayColor }]}>
        {inner}
      </View>
    );
  }

  if (variant === 'inline') {
    return <View style={s.inlineWrap}>{inner}</View>;
  }

  return <View style={s.fullscreen}>{inner}</View>;
}

// ─── Dot blink ────────────────────────────────────────────────────────────────

function DotBlink({ delay }: { delay: number }) {
  const op = useRef(new Animated.Value(0.15)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(op, { toValue: 1,    duration: 380, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0.15, duration: 380, useNativeDriver: true }),
        Animated.delay(Math.max(0, 660 - delay)),
      ])
    ).start();
  }, []);
  return <Animated.View style={[s.dot, { opacity: op }]} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  fullscreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  inlineWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  overlayWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 20,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: GOLD,
  },
  label: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    color: '#b8ab95',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});

// ─── Convenience wrappers ─────────────────────────────────────────────────────

/** Drop-in for full-cover overlay loading state */
export function LoadingOverlay({ label }: { label?: string }) {
  return <JackalLoader variant="overlay" label={label} />;
}

/** Drop-in for flex-centered loading state */
export function LoadingView({ label }: { label?: string }) {
  return <JackalLoader variant="fullscreen" label={label} />;
}
