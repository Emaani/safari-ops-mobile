/**
 * AnimatedCard
 *
 * Reanimated-powered card wrapper.
 * - Entrance: fade in + scale from 0.92 → 1 with staggered delay
 * - Press: spring scale down to 0.97 and back (tactile feedback)
 */

import React, { useEffect } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

interface AnimatedCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Stagger delay in ms for entrance animation */
  delay?: number;
  onPress?: () => void;
  /** Disable press scale (for non-interactive cards) */
  pressable?: boolean;
}

export function AnimatedCard({
  children,
  style,
  delay = 0,
  onPress,
  pressable = !!onPress,
}: AnimatedCardProps) {
  const opacity  = useSharedValue(0);
  const scale    = useSharedValue(0.92);
  const pressScale = useSharedValue(1);

  // Entrance animation on mount
  useEffect(() => {
    opacity.value  = withDelay(delay, withTiming(1,  { duration: 380, easing: Easing.out(Easing.cubic) }));
    scale.value    = withDelay(delay, withSpring(1, { damping: 18, stiffness: 200 }));
  }, [delay, opacity, scale]);

  // Press gesture
  const tap = Gesture.Tap()
    .onBegin(() => {
      pressScale.value = withSpring(0.97, { damping: 20, stiffness: 400 });
    })
    .onFinalize((e, success) => {
      pressScale.value = withSpring(1, { damping: 16, stiffness: 300 });
      if (success && onPress) {
        runOnJS(onPress)();
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [
      { scale: scale.value * (pressable ? pressScale.value : 1) },
    ],
  }));

  const inner = (
    <Animated.View style={[style, animStyle]}>
      {children}
    </Animated.View>
  );

  if (!pressable) return inner;

  return <GestureDetector gesture={tap}>{inner}</GestureDetector>;
}
