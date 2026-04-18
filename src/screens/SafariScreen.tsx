import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Svg, Path, Circle } from 'react-native-svg';
import { useSafariData } from '../hooks/useSafariData';
import { useSafariRealtimeSync } from '../hooks/useSafariRealtimeSync';
import { SafariCard, SafariDetailModal } from '../components/safari';
import { FadeSlideIn } from '../components/ui';
import type { Booking } from '../types/dashboard';

// ============================================================================
// CONSTANTS — warm earth palette
// ============================================================================

const COLORS = {
  background: '#f6f2eb',
  card: '#fffdf9',
  hero: '#171513',
  heroMuted: '#b8ab95',
  primary: '#1f4d45',
  primarySoft: '#dce8e3',
  text: '#181512',
  textMuted: '#7f7565',
  border: '#e1d7c8',
  gold: '#b8883f',
  goldSoft: '#f5e8ce',
  danger: '#c96d4d',
  success: '#3d8f6a',
};

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  Active: { bg: '#dce8e3', text: '#1f4d45', label: 'Active' },
  'In-Progress': { bg: '#d4ede2', text: '#3d8f6a', label: 'In Progress' },
  Planning: { bg: '#f5e8ce', text: '#b8883f', label: 'Planning' },
  Confirmed: { bg: '#e8edf5', text: '#4a7fc1', label: 'Confirmed' },
  Completed: { bg: '#ede9e4', text: '#7f7565', label: 'Completed' },
  Cancelled: { bg: '#fde8e0', text: '#c96d4d', label: 'Cancelled' },
  Pending: { bg: '#f5e8ce', text: '#b8883f', label: 'Pending' },
};

type FilterTab = 'all' | 'active' | 'upcoming' | 'history';

// ============================================================================
// ICON COMPONENTS
// ============================================================================

function CompassIcon({ size = 20, color = COLORS.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
    </Svg>
  );
}

function PlusIcon({ size = 22, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

function ChevronRightIcon({ size = 16, color = COLORS.textMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 18l6-6-6-6" />
    </Svg>
  );
}

// ============================================================================
// STAT NUMBER — animated entrance
// ============================================================================

interface StatNumberProps {
  label: string;
  value: number;
  delay?: number;
}

function StatNumber({ label, value, delay = 0 }: StatNumberProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);

  useEffect(() => {
    const cfg = { duration: 380, easing: Easing.out(Easing.cubic) };
    opacity.value = withDelay(delay, withTiming(1, cfg));
    translateY.value = withDelay(delay, withTiming(0, cfg));
  }, [delay, opacity, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.statNumber, animStyle]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

// ============================================================================
// FILTER PILL
// ============================================================================

interface FilterPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function FilterPill({ label, active, onPress }: FilterPillProps) {
  return (
    <Pressable
      style={[styles.filterPill, active && styles.filterPillActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ============================================================================
// LOADING OVERLAY
// ============================================================================

function LoadingOverlay() {
  return (
    <View style={styles.loadingOverlay}>
      <View style={styles.loadingCard}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading safaris...</Text>
      </View>
    </View>
  );
}

// ============================================================================
// ERROR MESSAGE
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
// EMPTY STATE
// ============================================================================

interface EmptyStateProps {
  tab: FilterTab;
}

function EmptyState({ tab }: EmptyStateProps) {
  const titles: Record<FilterTab, string> = {
    all: 'No safaris found',
    active: 'No active safaris today',
    upcoming: 'No upcoming safaris',
    history: 'No safari history',
  };
  const messages: Record<FilterTab, string> = {
    all: 'Safaris will appear here once they are created',
    active: 'Active safaris for today will appear here',
    upcoming: 'Confirmed safaris for the next 30 days will appear here',
    history: 'Completed safaris will appear here',
  };

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <CompassIcon size={32} color={COLORS.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>{titles[tab]}</Text>
      <Text style={styles.emptyMessage}>{messages[tab]}</Text>
    </View>
  );
}

// ============================================================================
// MAIN SAFARI SCREEN
// ============================================================================

export function SafariScreen() {
  console.log('[SafariScreen] Component mounted');

  // ========================================================================
  // STATE
  // ========================================================================

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSafari, setSelectedSafari] = useState<Booking | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // ========================================================================
  // HOOKS
  // ========================================================================

  const {
    safaris,
    activeToday,
    upcomingThisWeek,
    upcomingThisMonth,
    completed,
    completedThisMonth,
    loading,
    error,
    refetch,
  } = useSafariData();

  // Real-time sync
  useSafariRealtimeSync(refetch);

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  const displaySafaris = useMemo<Booking[]>(() => {
    switch (activeTab) {
      case 'active':
        return activeToday;
      case 'upcoming':
        return [...upcomingThisWeek, ...upcomingThisMonth];
      case 'history':
        return completed;
      case 'all':
      default:
        return safaris;
    }
  }, [activeTab, safaris, activeToday, upcomingThisWeek, upcomingThisMonth, completed]);

  const counts = useMemo(() => ({
    all: safaris.length,
    active: activeToday.length,
    upcoming: upcomingThisWeek.length + upcomingThisMonth.length,
    history: completed.length,
  }), [safaris, activeToday, upcomingThisWeek, upcomingThisMonth, completed]);

  // ========================================================================
  // CALLBACKS
  // ========================================================================

  const handleRefresh = useCallback(async () => {
    console.log('[SafariScreen] Pull-to-refresh triggered');
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleSafariPress = useCallback((safari: Booking) => {
    console.log('[SafariScreen] Safari pressed:', safari.booking_number || safari.id);
    setSelectedSafari(safari);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedSafari(null);
  }, []);

  // ========================================================================
  // RENDER — ERROR STATE
  // ========================================================================

  if (error && !loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.heroHeader}>
          <View style={styles.heroGlowLeft} />
          <View style={styles.heroGlowRight} />
          <Text style={styles.heroEyebrow}>Operations</Text>
          <Text style={styles.heroTitle}>Safari Management</Text>
        </View>
        <ErrorMessage
          message={error.message || 'Failed to load safari data'}
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  // ========================================================================
  // RENDER — HEADER (inside FlatList ListHeaderComponent)
  // ========================================================================

  const renderHeader = () => (
    <>
      {/* Stats bar */}
      <View style={styles.statsBar}>
        <StatNumber label="All" value={counts.all} delay={0} />
        <View style={styles.statsDivider} />
        <StatNumber label="Active" value={counts.active} delay={60} />
        <View style={styles.statsDivider} />
        <StatNumber label="Upcoming" value={counts.upcoming} delay={120} />
        <View style={styles.statsDivider} />
        <StatNumber label="Completed" value={counts.history} delay={180} />
      </View>

      {/* Section label */}
      <Text style={styles.sectionLabel}>
        {activeTab === 'all' && 'All Safaris'}
        {activeTab === 'active' && 'Active Today'}
        {activeTab === 'upcoming' && 'Upcoming Safaris'}
        {activeTab === 'history' && 'Safari History'}
      </Text>
    </>
  );

  const renderSafari = ({ item, index }: { item: Booking; index: number }) => (
    <FadeSlideIn delay={index * 60} distance={16}>
      <SafariCard safari={item} onPress={handleSafariPress} />
    </FadeSlideIn>
  );

  const renderEmpty = () =>
    !loading ? <EmptyState tab={activeTab} /> : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Loading overlay */}
      {loading && !refreshing && <LoadingOverlay />}

      {/* Dark hero header */}
      <View style={styles.heroHeader}>
        <View style={styles.heroGlowLeft} />
        <View style={styles.heroGlowRight} />

        {/* Eyebrow + title */}
        <Text style={styles.heroEyebrow}>Operations</Text>
        <Text style={styles.heroTitle}>Safari Management</Text>

        {/* Filter pills */}
        <View style={styles.filterPillRow}>
          <FilterPill label="All" active={activeTab === 'all'} onPress={() => setActiveTab('all')} />
          <FilterPill label="Active" active={activeTab === 'active'} onPress={() => setActiveTab('active')} />
          <FilterPill label="Upcoming" active={activeTab === 'upcoming'} onPress={() => setActiveTab('upcoming')} />
          <FilterPill label="History" active={activeTab === 'history'} onPress={() => setActiveTab('history')} />
        </View>
      </View>

      {/* Safari list */}
      <FlatList
        data={displaySafaris}
        keyExtractor={(item) => item.id}
        renderItem={renderSafari}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
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

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => {
          console.log('[SafariScreen] Add Safari tapped');
        }}
      >
        <PlusIcon size={22} color="#fff" />
      </TouchableOpacity>

      {/* Safari Detail Modal */}
      <SafariDetailModal
        safari={selectedSafari}
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

  // ── Hero header ────────────────────────────────────────────────────────────
  heroHeader: {
    backgroundColor: COLORS.hero,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    overflow: 'hidden',
    // subtle shadow below hero
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  heroGlowLeft: {
    position: 'absolute',
    top: -30,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#264a42',
    opacity: 0.32,
  },
  heroGlowRight: {
    position: 'absolute',
    right: -40,
    bottom: -20,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#6c5228',
    opacity: 0.2,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: COLORS.heroMuted,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: '#fffaf3',
    marginBottom: 14,
  },

  // ── Filter pills ───────────────────────────────────────────────────────────
  filterPillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
  },
  filterPillTextActive: {
    color: '#fff',
  },

  // ── Stats bar ──────────────────────────────────────────────────────────────
  statsBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 16,
    marginBottom: 20,
    shadowColor: '#201a13',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statNumber: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: COLORS.text,
    lineHeight: 30,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 3,
  },
  statsDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },

  // ── Section label ──────────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.textMuted,
    marginBottom: 12,
  },

  // ── List ───────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },

  // ── FAB ────────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },

  // ── Loading overlay ────────────────────────────────────────────────────────
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(246, 242, 235, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textMuted,
  },

  // ── Error ──────────────────────────────────────────────────────────────────
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default SafariScreen;
