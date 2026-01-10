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
import { Svg, Path, Circle } from 'react-native-svg';
import { useFleetData } from '../hooks/useFleetData';
import { useFleetRealtimeSync } from '../hooks/useFleetRealtimeSync';
import { VehicleCard, VehicleDetailModal, MaintenanceTracker } from '../components/fleet';
import type { Vehicle, VehicleStatus } from '../types/dashboard';

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

const STATUS_FILTERS: { label: string; value: VehicleStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Available', value: 'available' },
  { label: 'Booked', value: 'booked' },
  { label: 'Rented', value: 'rented' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Out of Service', value: 'out_of_service' },
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

function TruckIcon({ size = 20, color = COLORS.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M1 3h15v13H1z" />
      <Path d="M16 8h4l3 3v5h-7V8z" />
      <Circle cx="5.5" cy="18.5" r="2.5" />
      <Circle cx="18.5" cy="18.5" r="2.5" />
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
        <Text style={styles.loadingText}>Loading fleet...</Text>
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
// MAIN FLEET SCREEN
// ============================================================================

export function FleetScreen() {
  console.log('[FleetScreen] Component mounted');

  // ========================================================================
  // STATE
  // ========================================================================

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // ========================================================================
  // HOOKS
  // ========================================================================

  const { vehicles, repairs, loading, error, refetch } = useFleetData();

  // Real-time sync
  useFleetRealtimeSync(refetch);

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  const stats = useMemo(() => {
    const total = vehicles.length;
    const available = vehicles.filter((v) => v.status === 'available').length;
    const booked = vehicles.filter((v) => v.status === 'booked' || v.status === 'rented').length;
    const maintenance = vehicles.filter((v) => v.status === 'maintenance' || v.status === 'out_of_service').length;

    console.log('[FleetScreen] Stats computed:', { total, available, booked, maintenance });

    return { total, available, booked, maintenance };
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    let result = vehicles;

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((v) => v.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          v.license_plate.toLowerCase().includes(query) ||
          v.make.toLowerCase().includes(query) ||
          v.model.toLowerCase().includes(query)
      );
    }

    console.log(`[FleetScreen] Filtered ${result.length} vehicles from ${vehicles.length}`);

    return result;
  }, [vehicles, statusFilter, searchQuery]);

  // ========================================================================
  // CALLBACKS
  // ========================================================================

  const handleRefresh = useCallback(async () => {
    console.log('[FleetScreen] Pull-to-refresh triggered');
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleVehiclePress = useCallback((vehicle: Vehicle) => {
    console.log('[FleetScreen] Vehicle pressed:', vehicle.license_plate);
    setSelectedVehicle(vehicle);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedVehicle(null);
  }, []);

  // ========================================================================
  // RENDER
  // ========================================================================

  // Show error if data fetch failed
  if (error && !loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Fleet Management</Text>
        </View>
        <ErrorMessage
          message={error.message || 'Failed to load fleet data'}
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
          title="Total Fleet"
          value={stats.total}
          color={COLORS.primary}
          bgColor="#eff6ff"
        />
        <StatCard
          title="Available"
          value={stats.available}
          color={COLORS.success}
          bgColor="#dcfce7"
        />
        <StatCard
          title="On Safari"
          value={stats.booked}
          color={COLORS.purple}
          bgColor="#f3e8ff"
        />
        <StatCard
          title="Maintenance"
          value={stats.maintenance}
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
            placeholder="Search vehicles..."
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

      {/* Maintenance Tracker */}
      <MaintenanceTracker repairs={repairs} loading={loading} />

      {/* Vehicles List Header */}
      <Text style={styles.listHeader}>
        Vehicles ({filteredVehicles.length})
      </Text>
    </>
  );

  const renderVehicle = ({ item }: { item: Vehicle }) => (
    <VehicleCard vehicle={item} onPress={handleVehiclePress} />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <TruckIcon size={48} color={COLORS.textMuted} />
      <Text style={styles.emptyTitle}>No vehicles found</Text>
      <Text style={styles.emptyMessage}>
        {searchQuery || statusFilter !== 'all'
          ? 'Try adjusting your search or filters'
          : 'No vehicles in your fleet yet'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Loading Overlay */}
      {loading && !refreshing && <LoadingOverlay />}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fleet Management</Text>
      </View>

      {/* Main Content */}
      <FlatList
        data={filteredVehicles}
        keyExtractor={(item) => item.id}
        renderItem={renderVehicle}
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

      {/* Vehicle Detail Modal */}
      <VehicleDetailModal
        vehicle={selectedVehicle}
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
});

export default FleetScreen;
