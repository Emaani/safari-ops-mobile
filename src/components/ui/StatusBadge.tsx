import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getStatusColors } from '../../constants/tokens';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  /** Show the coloured dot indicator */
  showDot?: boolean;
}

export function StatusBadge({ status, size = 'md', showDot = true }: StatusBadgeProps) {
  const colors = getStatusColors(status);
  const isSmall = size === 'sm';

  // Humanise the label (e.g. "in_progress" → "In Progress")
  const label = status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  return (
    <View style={[
      s.badge,
      { backgroundColor: colors.bg },
      isSmall && s.badgeSm,
    ]}>
      {showDot && (
        <View style={[s.dot, { backgroundColor: colors.dot }, isSmall && s.dotSm]} />
      )}
      <Text style={[
        s.text,
        { color: colors.text },
        isSmall && s.textSm,
      ]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotSm: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  textSm: {
    fontSize: 11,
    lineHeight: 14,
  },
});
