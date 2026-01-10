import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  ViewStyle,
} from 'react-native';
import { Svg, Path, Rect } from 'react-native-svg';
import { formatCurrency, formatDateDMY, getStatusColor } from '../../lib/utils';
import type { Booking, Currency } from '../../types/dashboard';

// Booking item type for the widget (simplified from full Booking type)
interface BookingItem {
  id: string;
  booking_number?: string;
  start_date: string;
  status: string;
  total_cost: number;
  currency: Currency;
}

interface RecentBookingsWidgetProps {
  bookings: BookingItem[];
  loading: boolean;
  onBookingPress?: (booking: BookingItem) => void;
  style?: ViewStyle;
  maxVisible?: number;
}

// Calendar icon component
function CalendarIcon({ size = 16, color = '#6b7280' }: { size?: number; color?: string }) {
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

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const backgroundColor = getStatusColor(status);
  const displayStatus = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ').replace(/-/g, ' ');

  return (
    <View style={[styles.statusBadge, { backgroundColor }]}>
      <Text style={styles.statusBadgeText}>{displayStatus}</Text>
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
        <StatusBadge status={booking.status} />
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.dateContainer}>
          <CalendarIcon size={14} color="#6b7280" />
          <Text style={styles.dateText}>{formatDateDMY(booking.start_date)}</Text>
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
      <ActivityIndicator size="large" color="#3b82f6" />
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  countBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
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
    borderBottomColor: '#f3f4f6',
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
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'capitalize',
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
    fontWeight: '400',
    color: '#6b7280',
  },
  amountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  loadingContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '400',
    color: '#6b7280',
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
    fontWeight: '600',
    color: '#374151',
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '400',
    color: '#9ca3af',
    textAlign: 'center',
  },
});

export default RecentBookingsWidget;
