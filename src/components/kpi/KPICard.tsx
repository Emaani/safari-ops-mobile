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
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    flex: 1,
    minHeight: 120,
  },
  content: {
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '400',
    color: '#9ca3af',
    lineHeight: 16,
  },
});
