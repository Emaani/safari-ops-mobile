import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconColor?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  iconColor = '#3b82f6',
  onPress,
  style,
}: KPICardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.content}>
        {icon && (
          <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
            {icon}
          </View>
        )}

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>

        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fffdf9',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e1d7c8',
    shadowColor: '#201a13',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
    flex: 1,
    minHeight: 144,
  },
  content: {
    flex: 1,
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7f7565',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    color: '#181512',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#8a8173',
    lineHeight: 18,
  },
});
