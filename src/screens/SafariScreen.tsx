import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  SectionList,
  TouchableOpacity,
} from 'react-native';
import { Svg, Path, Circle } from 'react-native-svg';
import { useSafariData } from '../hooks/useSafariData';
import { useSafariRealtimeSync } from '../hooks/useSafariRealtimeSync';
import { SafariCard, SafariDetailModal } from '../components/safari';
import type { Booking } from '../types/dashboard';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#9333ea',
  safari: '#059669',
  background: '#f3f4f6',
  card: '#ffffff',
  text: '#111827',
  textMuted: '#6b7280',
  border: '#e5e7eb',
};

// ============================================================================
// ICON COMPONENTS
// ============================================================================

function CompassIcon({ size = 20, color = COLORS.safari }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
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
        <ActivityIndicator size="large" color={COLORS.safari} />
        <Text style={styles.loadingText}>Loading safaris...</Text>
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
// TAB SELECTOR COMPONENT
// ============================================================================

interface TabSelectorProps {
  tabs: { key: string; label: string }[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

function TabSelector({ tabs, activeTab, onTabChange }: TabSelectorProps) {
  return (
    <View style={styles.tabContainer}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tab,
            activeTab === tab.key && styles.tabActive,
          ]}
          onPress={() => onTabChange(tab.key)}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === tab.key && styles.tabTextActive,
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
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

  const [activeTab, setActiveTab] = useState<'active' | 'upcoming' | 'history'>('active');
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

  const stats = useMemo(() => {
    return {
      activeToday: activeToday.length,
      completedThisMonth: completedThisMonth.length,
      upcomingThisWeek: upcomingThisWeek.length,
    };
  }, [activeToday, completedThisMonth, upcomingThisWeek]);

  const displaySafaris = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return activeToday;
      case 'upcoming':
        return [...upcomingThisWeek, ...upcomingThisMonth];
      case 'history':
        return completed;
      default:
        return [];
    }
  }, [activeTab, activeToday, upcomingThisWeek, upcomingThisMonth, completed]);

  const tabs = [
    { key: 'active', label: `Active (${activeToday.length})` },
    { key: 'upcoming', label: `Upcoming (${upcomingThisWeek.length + upcomingThisMonth.length})` },
    { key: 'history', label: `History (${completed.length})` },
  ];

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
  // RENDER
  // ========================================================================

  // Show error if data fetch failed
  if (error && !loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Safari Trips</Text>
        </View>
        <ErrorMessage
          message={error.message || 'Failed to load safari data'}
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
          title="Active Today"
          value={stats.activeToday}
          color={COLORS.safari}
          bgColor="#d1fae5"
        />
        <StatCard
          title="This Week"
          value={stats.upcomingThisWeek}
          color={COLORS.primary}
          bgColor="#dbeafe"
        />
        <StatCard
          title="Completed (MTD)"
          value={stats.completedThisMonth}
          color={COLORS.purple}
          bgColor="#f3e8ff"
        />
      </View>

      {/* Tab Selector */}
      <TabSelector
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as any)}
      />

      {/* Section Header */}
      <Text style={styles.listHeader}>
        {activeTab === 'active' && 'Active Safaris Today'}
        {activeTab === 'upcoming' && 'Upcoming Safaris'}
        {activeTab === 'history' && 'Safari History'}
      </Text>
    </>
  );

  const renderSafari = ({ item }: { item: Booking }) => (
    <SafariCard safari={item} onPress={handleSafariPress} />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <CompassIcon size={48} color={COLORS.textMuted} />
      <Text style={styles.emptyTitle}>
        {activeTab === 'active' && 'No active safaris today'}
        {activeTab === 'upcoming' && 'No upcoming safaris'}
        {activeTab === 'history' && 'No safari history'}
      </Text>
      <Text style={styles.emptyMessage}>
        {activeTab === 'active' && 'Active safaris will appear here'}
        {activeTab === 'upcoming' && 'Confirmed safaris for the next 30 days will appear here'}
        {activeTab === 'history' && 'Completed safaris will appear here'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Loading Overlay */}
      {loading && !refreshing && <LoadingOverlay />}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Safari Trips</Text>
      </View>

      {/* Main Content */}
      <FlatList
        data={displaySafaris}
        keyExtractor={(item) => item.id}
        renderItem={renderSafari}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!loading ? renderEmpty : null}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.safari}
            colors={[COLORS.safari]}
          />
        }
      />

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
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
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
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: COLORS.safari,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  listHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
    marginTop: 8,
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
    backgroundColor: COLORS.safari,
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
    paddingHorizontal: 32,
  },
});

export default SafariScreen;
