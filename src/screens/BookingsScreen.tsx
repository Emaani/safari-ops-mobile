import { devLog } from '../lib/devLog';
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { FadeSlideIn } from '../components/ui';
import { Svg, Path, Rect, Circle } from 'react-native-svg';
import { useBookingsData } from '../hooks/useBookingsData';
import { useBookingsRealtimeSync } from '../hooks/useBookingsRealtimeSync';
import { useFleetData } from '../hooks/useFleetData';
import { useAuth } from '../contexts/AuthContext';
import { BookingCard, BookingDetailModal, EditBookingModal } from '../components/bookings';
import { NewBookingModal } from '../components/forms';
import { EmptyState, ListSkeleton } from '../components/ui';
import { tapLight, selectionTick, notifySuccess } from '../lib/haptics';
import { LoadingOverlay } from '../components/system/JackalLoader';
import type { Booking, BookingStatus } from '../types/dashboard';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary:    '#8B6B3E',
  success:    '#34A853',
  warning:    '#F5A623',
  danger:     '#FF3B30',
  purple:     '#7A5AF8',
  background: '#F2F2F7',
  card:       '#FFFFFF',
  text:       '#1C1C1E',
  textMuted:  '#6C6C70',
  border:     '#E5E5EA',
};

const STATUS_FILTERS: { label: string; value: BookingStatus | 'all' }[] = [
  { label: 'All',          value: 'all'         },
  { label: 'Confirmed',    value: 'Confirmed'   },
  { label: 'In-Progress',  value: 'In-Progress' },
  { label: 'Completed',    value: 'Completed'   },
  { label: 'Pending',      value: 'Pending'     },
  { label: 'Cancelled',    value: 'Cancelled'   },
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

function StatCard({
  title, value, color, bgColor, delay = 0,
}: StatCardProps & { delay?: number }) {
  const opacity = useSharedValue(0);
  const scale   = useSharedValue(0.88);

  React.useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
    scale.value   = withDelay(delay, withSpring(1, { damping: 18, stiffness: 220 }));
  }, [delay]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.statCard, { backgroundColor: bgColor }, animStyle]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={[styles.statTitle, { color }]}>{title}</Text>
    </Animated.View>
  );
}

// ============================================================================
// LOADING OVERLAY COMPONENT
// ============================================================================

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
// MONTH CALENDAR — lightweight month grid with per-day booking counts
// ============================================================================

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function toDateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function MonthCalendar({ month, onMonthChange, countByDate, selectedDate, onSelectDate }: {
  month: Date;
  onMonthChange: (d: Date) => void;
  countByDate: Record<string, number>;
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
}) {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstWeekday = new Date(year, monthIdx, 1).getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const todayKey = toDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const goPrev = () => { const d = new Date(year, monthIdx - 1, 1); onMonthChange(d); };
  const goNext = () => { const d = new Date(year, monthIdx + 1, 1); onMonthChange(d); };

  return (
    <View style={calStyles.card}>
      <View style={calStyles.navRow}>
        <TouchableOpacity onPress={goPrev} style={calStyles.navBtn}>
          <View style={{ transform: [{ rotate: '90deg' }] }}><ChevronDownIcon size={16} color={COLORS.primary} /></View>
        </TouchableOpacity>
        <Text style={calStyles.monthLabel}>{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</Text>
        <TouchableOpacity onPress={goNext} style={calStyles.navBtn}>
          <View style={{ transform: [{ rotate: '-90deg' }] }}><ChevronDownIcon size={16} color={COLORS.primary} /></View>
        </TouchableOpacity>
      </View>
      <View style={calStyles.weekRow}>
        {WEEKDAY_LABELS.map((w, i) => (
          <Text key={i} style={calStyles.weekLabel}>{w}</Text>
        ))}
      </View>
      <View style={calStyles.grid}>
        {cells.map((day, idx) => {
          if (day == null) return <View key={idx} style={calStyles.cell} />;
          const key = toDateKey(year, monthIdx, day);
          const count = countByDate[key] || 0;
          const isSelected = selectedDate === key;
          const isToday = key === todayKey;
          return (
            <TouchableOpacity
              key={idx}
              style={[calStyles.cell, isSelected && calStyles.cellSelected]}
              onPress={() => onSelectDate(key)}
              activeOpacity={0.7}
            >
              <Text style={[
                calStyles.cellText,
                isToday && !isSelected && calStyles.cellTextToday,
                isSelected && calStyles.cellTextSelected,
              ]}>{day}</Text>
              {count > 0 && <View style={[calStyles.dot, isSelected && { backgroundColor: '#fff' }]} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F5E8D0', alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  cellSelected: { backgroundColor: COLORS.primary },
  cellText: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  cellTextToday: { color: COLORS.primary, fontWeight: '800' },
  cellTextSelected: { color: '#fff', fontWeight: '800' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.primary, marginTop: 2 },
});

// ============================================================================
// MAIN BOOKINGS SCREEN
// ============================================================================

export function BookingsScreen() {
  devLog('[BookingsScreen] Component mounted');

  // ========================================================================
  // STATE
  // ========================================================================

  const [searchQuery,     setSearchQuery]     = useState('');
  const [statusFilter,    setStatusFilter]    = useState<BookingStatus | 'all'>('all');
  const [sortOption,      setSortOption]      = useState<SortOption>('date-desc');
  const [showSortMenu,    setShowSortMenu]    = useState(false);
  const [refreshing,      setRefreshing]      = useState(false);
  const [selectedBooking, setSelectedBooking]   = useState<Booking | null>(null);
  const [modalVisible,    setModalVisible]      = useState(false);
  const [editBooking,     setEditBooking]       = useState<Booking | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [showNewBooking,  setShowNewBooking]    = useState(false);
  const [viewMode,        setViewMode]          = useState<'list' | 'calendar'>('list');
  const [calMonth,        setCalMonth]          = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDate,    setSelectedDate]      = useState<string | null>(null);

  // ========================================================================
  // HOOKS
  // ========================================================================

  const { user } = useAuth();
  const { bookings, loading, error, refetch } = useBookingsData();
  const { vehicles } = useFleetData();

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

    devLog('[BookingsScreen] Stats computed:', { total, active, confirmed, pending });

    return { total, active, confirmed, pending };
  }, [bookings]);

  const bookingCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    bookings.forEach((b) => {
      const key = (b.start_date || '').slice(0, 10);
      if (key) map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    let result = [...bookings];

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((b) => b.status === statusFilter);
    }

    // Apply calendar date filter
    if (selectedDate) {
      result = result.filter((b) => (b.start_date || '').slice(0, 10) === selectedDate);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          (b.booking_reference || b.booking_number || b.id).toLowerCase().includes(query) ||
          (b.client_name || b.client?.company_name || b.contact_person || '').toLowerCase().includes(query) ||
          (b.package_type || '').toLowerCase().includes(query) ||
          (b.status || '').toLowerCase().includes(query) ||
          (b.email || '').toLowerCase().includes(query)
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
  }, [bookings, statusFilter, searchQuery, sortOption, selectedDate]);

  // ========================================================================
  // CALLBACKS
  // ========================================================================

  const handleRefresh = useCallback(async () => {
    devLog('[BookingsScreen] Pull-to-refresh triggered');
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleBookingPress = useCallback((booking: Booking) => {
    devLog('[BookingsScreen] Booking pressed:', booking.booking_number || booking.id);
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
      {/* New Booking button */}
      <TouchableOpacity
        style={styles.newBookingBtn}
        onPress={() => setShowNewBooking(true)}
        activeOpacity={0.85}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round">
          <Path d="M12 5v14M5 12h14" />
        </Svg>
        <Text style={styles.newBookingBtnText}>New Booking / Reservation</Text>
      </TouchableOpacity>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <StatCard title="Total"     value={stats.total}     color={COLORS.purple}  bgColor="#ede8f9" delay={0}   />
        <StatCard title="Active"    value={stats.active}    color={COLORS.success} bgColor="#D8F0E4" delay={60}  />
        <StatCard title="Confirmed" value={stats.confirmed} color={COLORS.primary} bgColor="#F5E8D0" delay={120} />
        <StatCard title="Pending"   value={stats.pending}   color={COLORS.warning} bgColor="#FDE8C0" delay={180} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <SearchIcon size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by booking #, client, package, status..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            autoCapitalize="none"
            blurOnSubmit={false}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* List / Calendar toggle */}
      <View style={styles.viewToggleRow}>
        <TouchableOpacity
          style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnOn]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[styles.viewToggleT, viewMode === 'list' && styles.viewToggleTOn]}>List</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewToggleBtn, viewMode === 'calendar' && styles.viewToggleBtnOn]}
          onPress={() => setViewMode('calendar')}
        >
          <Text style={[styles.viewToggleT, viewMode === 'calendar' && styles.viewToggleTOn]}>Calendar</Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'calendar' ? (
        <MonthCalendar
          month={calMonth}
          onMonthChange={setCalMonth}
          countByDate={bookingCountByDate}
          selectedDate={selectedDate}
          onSelectDate={(d) => setSelectedDate(prev => prev === d ? null : d)}
        />
      ) : (
        /* Status Filter Pills */
        <View style={styles.filterContainer}>
          <FlatList
            keyboardShouldPersistTaps="handled"
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
      )}

      {selectedDate && (
        <TouchableOpacity style={styles.dateFilterChip} onPress={() => setSelectedDate(null)}>
          <Text style={styles.dateFilterChipT}>
            {new Date(selectedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · Clear ✕
          </Text>
        </TouchableOpacity>
      )}

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

  const renderBooking = ({ item, index }: { item: Booking; index: number }) => (
    <FadeSlideIn delay={Math.min(index * 40, 320)} distance={16}>
      <BookingCard
        booking={item}
        onPress={(b) => { tapLight(); handleBookingPress(b); }}
        onEdit={(b) => { setEditBooking(b); setEditModalVisible(true); }}
        onCall={(b) => {
          const phone = (b as any).contact || (b as any).phone_number;
          if (phone) {
            tapLight();
            import('react-native').then(({ Linking }) =>
              Linking.openURL(`tel:${phone}`).catch(() => {})
            );
          }
        }}
      />
    </FadeSlideIn>
  );

  const renderEmpty = () => (
    <EmptyState
      type="bookings"
      title={searchQuery || statusFilter !== 'all' ? 'No results found' : 'No bookings yet'}
      subtitle={
        searchQuery || statusFilter !== 'all'
          ? 'Try adjusting your search or filters to find what you\'re looking for.'
          : 'Create your first booking to start managing safari trips for your clients.'
      }
      actionLabel={searchQuery || statusFilter !== 'all' ? undefined : 'Create Booking'}
      onAction={searchQuery || statusFilter !== 'all' ? undefined : () => setShowNewBooking(true)}
      secondaryLabel={searchQuery || statusFilter !== 'all' ? 'Clear Filters' : undefined}
      onSecondary={searchQuery || statusFilter !== 'all' ? () => {
        setSearchQuery('');
        setStatusFilter('all');
      } : undefined}
    />
  );

  function SkeletonLoader() {
    return <ListSkeleton rows={5} type="booking" />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Skeleton Loader */}
      {loading && !refreshing && <SkeletonLoader />}

      {/* Dark hero header */}
      <FadeSlideIn delay={0} distance={-10}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>Operations</Text>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroTitle}>Bookings</Text>
              <Text style={styles.heroSub}>{stats.total} total · {stats.active} active</Text>
            </View>
            {stats.active > 0 && (
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{stats.active} live</Text>
              </View>
            )}
          </View>
          {/* Animated filter tabs on dark bg */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.heroTabs}>
            {STATUS_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.value}
                style={[styles.heroTab, statusFilter === f.value && styles.heroTabActive]}
                onPress={() => { selectionTick(); setStatusFilter(f.value); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.heroTabText, statusFilter === f.value && styles.heroTabTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </FadeSlideIn>

      {/* Main Content */}
      <FlatList
        keyboardShouldPersistTaps="handled"
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
        onEdit={(booking) => {
          setEditBooking(booking);
          setEditModalVisible(true);
        }}
        onPaymentRecorded={refetch}
      />

      {/* Edit Booking Modal — Pending / Confirmed / In-Progress only */}
      <EditBookingModal
        booking={editBooking}
        visible={editModalVisible}
        onClose={() => { setEditModalVisible(false); setEditBooking(null); }}
        onSuccess={() => { setEditModalVisible(false); setEditBooking(null); refetch(); }}
        vehicles={vehicles}
      />

      {/* New Booking Modal */}
      <NewBookingModal
        visible={showNewBooking}
        onClose={() => setShowNewBooking(false)}
        onSuccess={() => { setShowNewBooking(false); refetch(); }}
        vehicles={vehicles}
        userId={user?.id}
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
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  // ── Hero header ──────────────────────────────────────────────────────────
  hero: {
    backgroundColor: '#1C1611',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 12,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#C4A882',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  heroTitle: {
    fontSize: 28, lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -1,
    color: '#fffaf3',
  },
  heroSub: {
    fontSize: 13, lineHeight: 19,
    color: '#C4A882',
    marginTop: 2,
  },
  heroBadge: {
    backgroundColor: '#8B6B3E',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  heroTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  heroTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroTabActive: {
    backgroundColor: '#FFFFFF',
  },
  heroTabText: {
    fontSize: 13, lineHeight: 19,
    fontWeight: '700',
    color: '#C4A882',
  },
  heroTabTextActive: {
    color: '#1C1C1E',
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  newBookingBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'center',
    gap:              8,
    backgroundColor:  COLORS.primary,
    borderRadius:     14,
    paddingVertical:  14,
    marginBottom:     16,
  },
  newBookingBtnText: {
    color:       '#fff',
    fontSize:    15,
    fontWeight:  '800',
    letterSpacing: 0.1,
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
    fontSize: 20, lineHeight: 26,
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
  viewToggleRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  viewToggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  viewToggleBtnOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  viewToggleT: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  viewToggleTOn: {
    color: '#fff',
  },
  dateFilterChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5E8D0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  dateFilterChipT: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
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
    fontSize: 13, lineHeight: 19,
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
    fontSize: 13, lineHeight: 19,
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
    fontSize: 14, lineHeight: 20,
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
    fontSize: 18, lineHeight: 24,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14, lineHeight: 20,
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
    fontSize: 14, lineHeight: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18, lineHeight: 24,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14, lineHeight: 20,
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
