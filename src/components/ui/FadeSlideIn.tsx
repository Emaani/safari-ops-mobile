/**
 * FadeSlideIn
 *
 * Wraps any child in a staggered fade + upward-slide entrance animation.
 * Use this on list items, section headers, stat rows — anything that
 * benefits from a polished entrance without gesture handling.
 */

import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

interface FadeSlideInProps {
  children: React.ReactNode;
  delay?: number;
  /** px to slide up from (default 20) */
  distance?: number;
  style?: ViewStyle | ViewStyle[];
}

export function FadeSlideIn({
  children,
  delay = 0,
  distance = 20,
  style,
}: FadeSlideInProps) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(distance);

  useEffect(() => {
    const cfg = { duration: 380, easing: Easing.out(Easing.cubic) };
    opacity.value    = withDelay(delay, withTiming(1, cfg));
    translateY.value = withDelay(delay, withTiming(0, cfg));
  }, [delay, distance, opacity, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[style, animStyle]}>
      {children}
    </Animated.View>
  );
}
