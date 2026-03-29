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
    backgroundColor: '#fffdf9',
    borderRadius: 24,
    padding: 20,
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
    position: 'relative',
    overflow: 'hidden',
  },
  decorativeGradient: {
    position: 'absolute',
    top: -28,
    right: -20,
    width: 132,
    height: 132,
    backgroundColor: '#e7d5b0',
    opacity: 0.32,
    borderRadius: 66,
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
    fontSize: 11,
    fontWeight: '700',
    color: '#7f7565',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 14,
  },
  loadingContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  amount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#181512',
    letterSpacing: -1.3,
    marginBottom: 10,
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
    color: '#7f7565',
  },
  badge: {
    backgroundColor: '#fbede7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#efd0c4',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a34f35',
  },
  iconContainer: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#1f4d45',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1f4d45',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default OutstandingPaymentsCard;
