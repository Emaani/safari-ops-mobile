import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  ViewStyle,
  Animated,
} from 'react-native';
import { Svg, Path, Rect } from 'react-native-svg';
import { formatCurrency } from '../../lib/utils';
import { getBookingStatusConfig } from '../../constants/bookingStatus';
import type { Currency } from '../../types/dashboard';

// Booking item type for the widget (simplified from full Booking type)
interface BookingItem {
  id: string;
  booking_number?: string;
  start_date: string;
  end_date?: string;
  status: string;
  total_cost: number;
  currency: Currency;
}

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDateRange(start: string, end?: string): string {
  const s = new Date(start);
  const startStr = `${s.getDate()} ${SHORT_MONTHS[s.getMonth()]}`;
  if (!end) return startStr;
  const e = new Date(end);
  const endStr = `${e.getDate()} ${SHORT_MONTHS[e.getMonth()]}`;
  const nights = Math.max(0, Math.round((e.getTime() - s.getTime()) / 86400000));
  return nights > 0 ? `${startStr} – ${endStr} · ${nights}d` : startStr;
}

// If the trip's end date has passed but the DB status was never updated,
// show the correct effective status rather than the stale stored value.
function getEffectiveStatus(status: string, endDate?: string): string {
  if (!endDate) return status;
  if (status !== 'In-Progress' && status !== 'Pending') return status;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return end < today ? 'Completed' : status;
}

interface RecentBookingsWidgetProps {
  bookings: BookingItem[];
  loading: boolean;
  onBookingPress?: (booking: BookingItem) => void;
  style?: ViewStyle;
  maxVisible?: number;
}

// Calendar icon component
function CalendarIcon({ size = 16, color = '#6C6C70' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <Path d="M16 2v4" />
      <Path d="M8 2v4" />
      <Path d="M3 10h18" />
    </Svg>
  );
}

// File text icon component
function FileTextIcon({ size = 40, color = '#9ca3af' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
      <Path d="M16 13H8" />
      <Path d="M16 17H8" />
      <Path d="M10 9H8" />
    </Svg>
  );
}

// Status badge component — uses pastel bg/text/dot from bookingStatus.ts for all statuses
function StatusBadge({ status }: { status: string }) {
  const { bg, text, dot, label } = getBookingStatusConfig(status);
  const isActive = status === 'In-Progress';
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isActive, pulseAnim]);

  return (
    <View style={[styles.statusBadge, { backgroundColor: bg, borderColor: dot }]}>
      {isActive ? (
        <Animated.View style={[styles.statusDot, { backgroundColor: dot, transform: [{ scale: pulseAnim }] }]} />
      ) : (
        <View style={[styles.statusDot, { backgroundColor: dot }]} />
      )}
      <Text style={[styles.statusBadgeText, { color: text }]}>{label}</Text>
    </View>
  );
}

// Individual booking item component
function BookingListItem({
  booking,
  onPress,
  isLast,
}: {
  booking: BookingItem;
  onPress?: () => void;
  isLast: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.bookingItem, !isLast && styles.bookingItemBorder]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.bookingHeader}>
        <Text style={styles.bookingNumber}>{booking.booking_number || `#${booking.id.slice(0, 8)}`}</Text>
        <StatusBadge status={getEffectiveStatus(booking.status, booking.end_date)} />
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.dateContainer}>
          <CalendarIcon size={14} color="#6C6C70" />
          <Text style={styles.dateText}>{formatDateRange(booking.start_date, booking.end_date)}</Text>
        </View>
        <Text style={styles.amountText}>
          {formatCurrency(booking.total_cost, booking.currency)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// Empty state component
function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <FileTextIcon size={40} color="#9ca3af" />
      <Text style={styles.emptyTitle}>No bookings found</Text>
      <Text style={styles.emptySubtitle}>Recent bookings will appear here</Text>
    </View>
  );
}

// Loading state component
function LoadingState() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#8B6B3E" />
      <Text style={styles.loadingText}>Loading bookings...</Text>
    </View>
  );
}

export function RecentBookingsWidget({
  bookings,
  loading,
  onBookingPress,
  style,
  maxVisible = 10,
}: RecentBookingsWidgetProps) {
  // Take only the most recent bookings up to maxVisible
  const displayBookings = bookings.slice(0, maxVisible);
  const showScrollView = displayBookings.length > 5;

  const renderContent = () => {
    if (loading) {
      return <LoadingState />;
    }

    if (!bookings || bookings.length === 0) {
      return <EmptyState />;
    }

    const bookingsList = displayBookings.map((booking, index) => (
      <BookingListItem
        key={booking.id}
        booking={booking}
        onPress={onBookingPress ? () => onBookingPress(booking) : undefined}
        isLast={index === displayBookings.length - 1}
      />
    ));

    if (showScrollView) {
      return (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          {bookingsList}
        </ScrollView>
      );
    }

    return <View style={styles.bookingsList}>{bookingsList}</View>;
  };

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Bookings</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {loading ? '-' : bookings.length}
          </Text>
        </View>
      </View>

      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#1C1C1E',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.6,
  },
  countBadge: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C6C70',
  },
  scrollView: {
    maxHeight: 300,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  bookingsList: {
    minHeight: 50,
  },
  bookingItem: {
    paddingVertical: 12,
  },
  bookingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bookingNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  bookingDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6C6C70',
  },
  amountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  loadingContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
    color: '#6C6C70',
  },
  emptyContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '400',
    color: '#9a8f7e',
    textAlign: 'center',
  },
});

export default RecentBookingsWidget;
