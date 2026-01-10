import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Svg, Path, Circle } from 'react-native-svg';
import type { Repair } from '../../types/dashboard';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  background: '#f3f4f6',
  card: '#ffffff',
  text: '#111827',
  textMuted: '#6b7280',
  border: '#e5e7eb',
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: '#fee2e2', text: '#991b1b' },
  high: { bg: '#fef3c7', text: '#92400e' },
  medium: { bg: '#dbeafe', text: '#1e40af' },
  low: { bg: '#dcfce7', text: '#166534' },
};

// ============================================================================
// ICON COMPONENT
// ============================================================================

function WrenchIcon({ size = 16, color = COLORS.warning }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </Svg>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

interface MaintenanceTrackerProps {
  repairs: Repair[];
  loading?: boolean;
}

export function MaintenanceTracker({ repairs, loading }: MaintenanceTrackerProps) {
  console.log('[MaintenanceTracker] Rendering with', repairs.length, 'repairs');

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <WrenchIcon size={18} color={COLORS.warning} />
          <Text style={styles.headerTitle}>Active Repairs</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (repairs.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <WrenchIcon size={18} color={COLORS.warning} />
          <Text style={styles.headerTitle}>Active Repairs</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No active repairs</Text>
        </View>
      </View>
    );
  }

  const renderRepairItem = ({ item }: { item: Repair }) => {
    const priorityColors = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium;
    const vehiclePlate = item.vehicles?.license_plate || 'Unknown';
    const reportedDate = item.reported_at
      ? new Date(item.reported_at).toLocaleDateString()
      : 'N/A';

    return (
      <View style={styles.repairItem}>
        <View style={styles.repairHeader}>
          <Text style={styles.vehiclePlate}>{vehiclePlate}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: priorityColors.bg }]}>
            <Text style={[styles.priorityText, { color: priorityColors.text }]}>
              {item.priority}
            </Text>
          </View>
        </View>
        <Text style={styles.repairDescription} numberOfLines={2}>
          {item.description || 'No description'}
        </Text>
        <View style={styles.repairFooter}>
          <Text style={styles.repairStatus}>
            Status: {item.status?.replace('_', ' ')}
          </Text>
          <Text style={styles.repairDate}>Reported: {reportedDate}</Text>
        </View>
        {item.estimated_cost && (
          <Text style={styles.estimatedCost}>
            Est. Cost: ${item.estimated_cost.toLocaleString()}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <WrenchIcon size={18} color={COLORS.warning} />
        <Text style={styles.headerTitle}>Active Repairs ({repairs.length})</Text>
      </View>
      <FlatList
        data={repairs.slice(0, 5)}
        keyExtractor={(item) => item.id}
        renderItem={renderRepairItem}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
      />
      {repairs.length > 5 && (
        <Text style={styles.moreText}>
          +{repairs.length - 5} more repairs
        </Text>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  repairItem: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 12,
  },
  repairHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  vehiclePlate: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  repairDescription: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  repairFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  repairStatus: {
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'capitalize',
  },
  repairDate: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  estimatedCost: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.warning,
    marginTop: 4,
  },
  moreText: {
    fontSize: 12,
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 8,
  },
});
