import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { formatCurrency } from '../../lib/utils';
import type { Currency } from '../../types/dashboard';

interface OutstandingPaymentsCardProps {
  amount: number;
  count: number;
  currency: Currency;
  onPress?: () => void;
  loading?: boolean;
  style?: ViewStyle;
}

// AlertCircle icon component
function AlertCircleIcon({ size = 28, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <Path d="M12 8v4" />
      <Path d="M12 16h.01" />
    </Svg>
  );
}

// DollarSign icon component
function DollarSignIcon({ size = 28, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2v20" />
      <Path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Svg>
  );
}

export function OutstandingPaymentsCard({
  amount,
  count,
  currency,
  onPress,
  loading = false,
  style,
}: OutstandingPaymentsCardProps) {
  const formattedAmount = formatCurrency(amount, currency);
  const hasOutstanding = count > 0;

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* Decorative background gradient effect */}
      <View style={styles.decorativeGradient} />

      <View style={styles.content}>
        <View style={styles.mainContent}>
          <Text style={styles.title}>
            OUTSTANDING PAYMENTS - {currency}
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ef4444" />
            </View>
          ) : (
            <>
              <Text style={styles.amount}>
                {formattedAmount}
              </Text>

              <View style={styles.subtitleContainer}>
                <Text style={styles.subtitle}>
                  {count} {count === 1 ? 'booking' : 'bookings'}
                </Text>
                {hasOutstanding && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Action Required</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>

        <View style={styles.iconContainer}>
          {hasOutstanding ? (
            <AlertCircleIcon size={28} color="#ffffff" />
          ) : (
            <DollarSignIcon size={28} color="#ffffff" />
          )}
        </View>
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
    position: 'relative',
    overflow: 'hidden',
  },
  decorativeGradient: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 100,
    height: 100,
    backgroundColor: '#ef4444',
    opacity: 0.05,
    borderRadius: 50,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  mainContent: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  loadingContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  amount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6b7280',
  },
  badge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default OutstandingPaymentsCard;
