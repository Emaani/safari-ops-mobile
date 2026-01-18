import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Svg, Path, Rect, Circle } from 'react-native-svg';
import { useBookingsData } from '../hooks/useBookingsData';
import { useBookingsRealtimeSync } from '../hooks/useBookingsRealtimeSync';
import { BookingCard, BookingDetailModal } from '../components/bookings';
import type { Booking, BookingStatus } from '../types/dashboard';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#9333ea',
  background: '#f3f4f6',
  card: '#ffffff',
  text: '#111827',
  textMuted: '#6b7280',
  border: '#e5e7eb',
};

const STATUS_FILTERS: { label: string; value: BookingStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Confirmed', value: 'Confirmed' },
  { label: 'In-Progress', value: 'In-Progress' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Pending', value: 'Pending' },
];

type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'client-asc' | 'client-desc';

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Newest First', value: 'date-desc' },
  { label: 'Oldest First', value: 'date-asc' },
  { label: 'Amount (High-Low)', value: 'amount-desc' },
  { label: 'Amount (Low-High)', value: 'amount-asc' },
  { label: 'Client (A-Z)', value: 'client-asc' },
  { label: 'Client (Z-A)', value: 'client-desc' },
];

// ============================================================================
// ICON COMPONENTS
// ============================================================================

function SearchIcon({ size = 20, color = COLORS.textMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx="11" cy="11" r="8" />
      <Path d="M21 21l-4.35-4.35" />
    </Svg>
  );
}

function CalendarIcon({ size = 20, color = COLORS.purple }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <Path d="M16 2v4" />
      <Path d="M8 2v4" />
      <Path d="M3 10h18" />
    </Svg>
  );
}

function SortIcon({ size = 20, color = COLORS.textMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M11 5h10" />
      <Path d="M11 9h7" />
      <Path d="M11 13h4" />
      <Path d="M3 17l3 3 3-3" />
      <Path d="M6 18V4" />
    </Svg>
  );
}

function ChevronDownIcon({ size = 16, color = COLORS.textMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  color: string;
  bgColor: string;
}

function StatCard({ title, value, color, bgColor }: StatCardProps) {
  return (
    <View style={[styles.statCard, { backgroundColor: bgColor }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={[styles.statTitle, { color }]}>{title}</Text>
    </View>
  );
}

// ============================================================================
// LOADING OVERLAY COMPONENT
// ============================================================================

function LoadingOverlay() {
  return (
    <View style={styles.loadingOverlay}>
      <View style={styles.loadingCard}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading bookings...</Text>
      </View>
    </View>
  );
}

// ============================================================================
// ERROR MESSAGE COMPONENT
// ============================================================================

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Tap to retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ============================================================================
// MAIN BOOKINGS SCREEN
// ============================================================================

export function BookingsScreen() {
  console.log('[BookingsScreen] Component mounted');

  // ========================================================================
  // STATE
  // ========================================================================

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // ========================================================================
  // HOOKS
  // ========================================================================

  const { bookings, loading, error, refetch } = useBookingsData();

  // Real-time sync
  useBookingsRealtimeSync(refetch);

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  const stats = useMemo(() => {
    const total = bookings.length;
    const active = bookings.filter((b) => b.status === 'In-Progress').length;
    const confirmed = bookings.filter((b) => b.status === 'Confirmed').length;
    const pending = bookings.filter((b) => b.status === 'Pending').length;

    console.log('[BookingsScreen] Stats computed:', { total, active, confirmed, pending });

    return { total, active, confirmed, pending };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    let result = [...bookings];

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((b) => b.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          (b.booking_number || b.id).toLowerCase().includes(query) ||
          (b.client?.company_name || '').toLowerCase().includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortOption) {
        case 'date-desc':
          return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
        case 'date-asc':
          return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        case 'amount-desc':
          return (b.total_amount || b.total_cost || 0) - (a.total_amount || a.total_cost || 0);
        case 'amount-asc':
          return (a.total_amount || a.total_cost || 0) - (b.total_amount || b.total_cost || 0);
        case 'client-asc':
          return (a.client?.company_name || '').localeCompare(b.client?.company_name || '');
        case 'client-desc':
          return (b.client?.company_name || '').localeCompare(a.client?.company_name || '');
        default:
          return 0;
      }
    });

    return result;
  }, [bookings, statusFilter, searchQuery, sortOption]);

  // ========================================================================
  // CALLBACKS
  // ========================================================================

  const handleRefresh = useCallback(async () => {
    console.log('[BookingsScreen] Pull-to-refresh triggered');
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleBookingPress = useCallback((booking: Booking) => {
    console.log('[BookingsScreen] Booking pressed:', booking.booking_number || booking.id);
    setSelectedBooking(booking);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedBooking(null);
  }, []);

  // ========================================================================
  // RENDER
  // ========================================================================

  // Show error if data fetch failed
  if (error && !loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Bookings</Text>
        </View>
        <ErrorMessage
          message={error.message || 'Failed to load bookings data'}
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <>
      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <StatCard
          title="Total"
          value={stats.total}
          color={COLORS.purple}
          bgColor="#f3e8ff"
        />
        <StatCard
          title="Active"
          value={stats.active}
          color={COLORS.success}
          bgColor="#dcfce7"
        />
        <StatCard
          title="Confirmed"
          value={stats.confirmed}
          color={COLORS.primary}
          bgColor="#dbeafe"
        />
        <StatCard
          title="Pending"
          value={stats.pending}
          color={COLORS.warning}
          bgColor="#fef3c7"
        />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <SearchIcon size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by booking # or client..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Status Filter Pills */}
      <View style={styles.filterContainer}>
        <FlatList
          data={STATUS_FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterPill,
                statusFilter === item.value && styles.filterPillActive,
              ]}
              onPress={() => setStatusFilter(item.value)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  statusFilter === item.value && styles.filterPillTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Bookings List Header with Sort */}
      <View style={styles.listHeaderRow}>
        <Text style={styles.listHeader}>
          Bookings ({filteredBookings.length})
        </Text>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setShowSortMenu(!showSortMenu)}
        >
          <SortIcon size={18} color={COLORS.primary} />
          <Text style={styles.sortButtonText}>
            {SORT_OPTIONS.filter(o => o.value === sortOption)[0]?.label || 'Sort'}
          </Text>
          <ChevronDownIcon size={14} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Sort Menu Dropdown */}
      {showSortMenu && (
        <View style={styles.sortMenu}>
          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortMenuItem,
                sortOption === option.value && styles.sortMenuItemActive,
              ]}
              onPress={() => {
                setSortOption(option.value);
                setShowSortMenu(false);
              }}
            >
              <Text
                style={[
                  styles.sortMenuItemText,
                  sortOption === option.value && styles.sortMenuItemTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );

  const renderBooking = ({ item }: { item: Booking }) => (
    <BookingCard booking={item} onPress={handleBookingPress} />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <CalendarIcon size={48} color={COLORS.textMuted} />
      <Text style={styles.emptyTitle}>No bookings found</Text>
      <Text style={styles.emptyMessage}>
        {searchQuery || statusFilter !== 'all'
          ? 'Try adjusting your search or filters'
          : 'No bookings yet'}
      </Text>
    </View>
  );

  // Added skeleton loader for smoother loading experience
  function SkeletonLoader() {
    return (
      <View style={styles.skeletonContainer}>
        {[...Array(5)].map((_, index) => (
          <View key={index} style={styles.skeletonCard} />
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Skeleton Loader */}
      {loading && !refreshing && <SkeletonLoader />}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bookings</Text>
      </View>

      {/* Main Content */}
      <FlatList
        data={filteredBookings}
        keyExtractor={(item) => item.id}
        renderItem={renderBooking}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!loading ? renderEmpty : null}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      />

      {/* Booking Detail Modal */}
      <BookingDetailModal
        booking={selectedBooking}
        visible={modalVisible}
        onClose={handleCloseModal}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '22%',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  statTitle: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: COLORS.text,
    marginLeft: 8,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  listHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 6,
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.primary,
  },
  sortMenu: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sortMenuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sortMenuItemActive: {
    backgroundColor: '#eff6ff',
  },
  sortMenuItemText: {
    fontSize: 14,
    color: COLORS.text,
  },
  sortMenuItemTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(243, 244, 246, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  skeletonContainer: {
    padding: 16,
  },
  skeletonCard: {
    height: 80,
    backgroundColor: COLORS.border,
    borderRadius: 8,
    marginBottom: 12,
  },
});

export default BookingsScreen;
