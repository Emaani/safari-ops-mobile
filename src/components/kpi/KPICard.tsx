/**
 * KPICard — animated metric tile
 *
 * Plum-inspired: icon in tinted circle, uppercase label, bold large value,
 * soft subtitle. Uses Reanimated for entrance (fade+scale) and press feedback.
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

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconColor?: string;
  /** Optional % change label, e.g. "+12% this month" */
  trend?: { label: string; positive: boolean };
  onPress?: () => void;
  style?: ViewStyle;
  /** Stagger delay for entrance animation */
  delay?: number;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  iconColor = '#1f4d45',
  trend,
  onPress,
  style,
  delay = 0,
}: KPICardProps) {
  const opacity     = useSharedValue(0);
  const entrScale   = useSharedValue(0.9);
  const pressScale  = useSharedValue(1);

  // Entrance
  useEffect(() => {
    opacity.value   = withDelay(delay, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
    entrScale.value = withDelay(delay, withSpring(1, { damping: 18, stiffness: 220 }));
  }, [delay, opacity, entrScale]);

  // Press gesture
  const tap = Gesture.Tap()
    .onBegin(() => {
      pressScale.value = withSpring(0.96, { damping: 20, stiffness: 400 });
    })
    .onFinalize(() => {
      pressScale.value = withSpring(1, { damping: 15, stiffness: 280 });
    });

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: entrScale.value * (onPress ? pressScale.value : 1) }],
  }));

  const card = (
    <Animated.View style={[styles.card, style, animStyle]}>
      {/* Icon circle */}
      {icon && (
        <View style={[styles.iconWrap, { backgroundColor: iconColor + '18' }]}>
          {icon}
        </View>
      )}

      {/* Label */}
      <Text style={styles.label} numberOfLines={1}>{title}</Text>

      {/* Big value */}
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>

      {/* Trend badge */}
      {trend && (
        <View style={[styles.trendBadge, { backgroundColor: trend.positive ? '#dce8e3' : '#fdf0ec' }]}>
          <Text style={[styles.trendText, { color: trend.positive ? '#3d8f6a' : '#c96d4d' }]}>
            {trend.positive ? '▲' : '▼'} {trend.label}
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
    backgroundColor: '#fffdf9',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e1d7c8',
    shadowColor: '#201a13',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
    flex: 1,
    minHeight: 148,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9a8f7e',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 6,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    color: '#181512',
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  trendBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    color: '#9a8f7e',
    lineHeight: 16,
    marginTop: 2,
  },
});
