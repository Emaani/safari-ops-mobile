/**
 * KPICard — Apple-quality metric tile with circular progress ring.
 *
 * Layout: metric label at top, SVG progress ring with icon in center,
 * bold value below. Inspired by iOS home-screen app widget style.
 */

import React, { useEffect } from 'react';
import { Text, View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Svg, { Circle } from 'react-native-svg';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconColor?: string;
  /** 0–1 progress fraction shown in the ring (default 0.7 for visual interest) */
  progress?: number;
  trend?: { label: string; positive: boolean };
  onPress?: () => void;
  style?: ViewStyle;
  delay?: number;
}

const RING_SIZE   = 64;
const RING_RADIUS = 27;
const RING_STROKE = 4;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  iconColor = '#8B6B3E',
  progress = 0.7,
  trend,
  onPress,
  style,
  delay = 0,
}: KPICardProps) {
  const opacity    = useSharedValue(0);
  const entrScale  = useSharedValue(0.94);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    opacity.value   = withDelay(delay, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
    entrScale.value = withDelay(delay, withSpring(1, { damping: 20, stiffness: 260 }));
  }, [delay, opacity, entrScale]);

  const tap = Gesture.Tap()
    .onBegin(() => { pressScale.value = withSpring(0.96, { damping: 20, stiffness: 400 }); })
    .onFinalize(() => { pressScale.value = withSpring(1, { damping: 15, stiffness: 280 }); });

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: entrScale.value * (onPress ? pressScale.value : 1) }],
  }));

  const clampedProgress = Math.min(1, Math.max(0, progress));
  const dashOffset = CIRCUMFERENCE * (1 - clampedProgress);

  const card = (
    <Animated.View style={[styles.card, style, animStyle]}>
      {/* Metric label */}
      <Text style={styles.label} numberOfLines={2}>{title}</Text>

      {/* Progress ring + icon */}
      <View style={styles.ringWrap}>
        <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ring}>
          {/* Track */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={iconColor + '20'}
            strokeWidth={RING_STROKE}
          />
          {/* Progress arc */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={iconColor}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`}
          />
        </Svg>
        {/* Icon centered inside ring */}
        {icon && (
          <View style={[styles.iconWrap, { backgroundColor: iconColor + '18' }]}>
            {icon}
          </View>
        )}
      </View>

      {/* Value */}
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Text>

      {/* Trend */}
      {trend && (
        <View style={[styles.trendBadge, { backgroundColor: trend.positive ? '#E8F7EE' : '#FFEEED' }]}>
          <Text style={[styles.trendText, { color: trend.positive ? '#1A6B3C' : '#CC1400' }]}>
            {trend.positive ? '↑' : '↓'} {trend.label}
          </Text>
        </View>
      )}

      {/* Subtitle */}
      {subtitle && (
        <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
      )}
    </Animated.View>
  );

  if (!onPress) return card;
  return <GestureDetector gesture={tap}>{card}</GestureDetector>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    flex: 1,
    minHeight: 164,
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C6C70',
    textAlign: 'center',
    letterSpacing: 0.1,
    lineHeight: 16,
    marginBottom: 10,
    alignSelf: 'stretch',
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  ring: {
    position: 'absolute',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 4,
  },
  trendBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
    marginBottom: 4,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  subtitle: {
    fontSize: 11,
    color: '#AEAEB2',
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 2,
  },
});
