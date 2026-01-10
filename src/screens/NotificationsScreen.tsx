import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import type { Notification, NotificationStatus } from '../types/notification';
import { format } from 'date-fns';

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
  unread: '#eff6ff',
};

/**
 * Notifications Screen
 *
 * Displays all notifications for the authenticated user.
 * Features:
 * - Real-time notification updates
 * - Filter by status (all, unread, read)
 * - Mark as read/unread
 * - Delete notifications
 * - Pull to refresh
 * - Navigation to related screens
 */

export default function NotificationsScreen({ navigation }: any) {
  const { user } = useAuth();
  const userId = user?.id || '';

  const [filterStatus, setFilterStatus] = useState<NotificationStatus | 'all'>('all');

  const {
    notifications,
    summary,
    loading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    setFilters,
  } = useNotifications(userId);

  const [refreshing, setRefreshing] = useState(false);

  // Handle pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Handle filter change
  const handleFilterChange = useCallback((status: NotificationStatus | 'all') => {
    setFilterStatus(status);
    if (status === 'all') {
      setFilters({});
    } else {
      setFilters({ status });
    }
  }, [setFilters]);

  // Handle notification tap
  const handleNotificationTap = useCallback(async (notification: Notification) => {
    // Mark as read if unread
    if (notification.status === 'unread') {
      await markAsRead(notification.id);
    }

    // Navigate to related screen if applicable
    if (notification.data?.screen) {
      navigation.navigate(notification.data.screen, notification.data.params || {});
    }
  }, [markAsRead, navigation]);

  // Handle delete notification
  const handleDeleteNotification = useCallback((notificationId: string) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteNotification(notificationId),
        },
      ]
    );
  }, [deleteNotification]);

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(() => {
    Alert.alert(
      'Mark All as Read',
      'Are you sure you want to mark all notifications as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark All',
          onPress: () => markAllAsRead(),
        },
      ]
    );
  }, [markAllAsRead]);

  // Render notification item
  const renderNotificationItem = useCallback(({ item }: { item: Notification }) => {
    const isUnread = item.status === 'unread';
    const notificationDate = new Date(item.created_at);
    const formattedDate = format(notificationDate, 'MMM dd, yyyy h:mm a');

    return (
      <TouchableOpacity
        style={[styles.notificationItem, isUnread && styles.notificationUnread]}
        onPress={() => handleNotificationTap(item)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationHeader}>
          <View style={styles.notificationTitleRow}>
            <NotificationIcon type={item.type} priority={item.priority} />
            <Text style={[styles.notificationTitle, isUnread && styles.notificationTitleUnread]}>
              {item.title}
            </Text>
            {isUnread && <View style={styles.unreadDot} />}
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteNotification(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <TrashIcon size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
        <Text style={styles.notificationMessage}>{item.message}</Text>
        <Text style={styles.notificationDate}>{formattedDate}</Text>
      </TouchableOpacity>
    );
  }, [handleNotificationTap, handleDeleteNotification]);

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <BellIcon size={64} color={COLORS.textMuted} />
      <Text style={styles.emptyStateTitle}>No Notifications</Text>
      <Text style={styles.emptyStateMessage}>
        {filterStatus === 'unread'
          ? 'You have no unread notifications'
          : 'You have no notifications at this time'}
      </Text>
    </View>
  );

  // Render loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (error && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading notifications</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Text style={styles.headerSubtitle}>
          {summary.unread} unread of {summary.total} total
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filterStatus === 'all' && styles.filterTabActive]}
          onPress={() => handleFilterChange('all')}
        >
          <Text style={[styles.filterTabText, filterStatus === 'all' && styles.filterTabTextActive]}>
            All ({summary.total})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filterStatus === 'unread' && styles.filterTabActive]}
          onPress={() => handleFilterChange('unread')}
        >
          <Text style={[styles.filterTabText, filterStatus === 'unread' && styles.filterTabTextActive]}>
            Unread ({summary.unread})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filterStatus === 'read' && styles.filterTabActive]}
          onPress={() => handleFilterChange('read')}
        >
          <Text style={[styles.filterTabText, filterStatus === 'read' && styles.filterTabTextActive]}>
            Read ({summary.total - summary.unread})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mark All as Read Button */}
      {summary.unread > 0 && (
        <TouchableOpacity style={styles.markAllButton} onPress={handleMarkAllAsRead}>
          <CheckIcon size={16} color={COLORS.primary} />
          <Text style={styles.markAllButtonText}>Mark All as Read</Text>
        </TouchableOpacity>
      )}

      {/* Notifications List */}
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

// ============================================================================
// ICON COMPONENTS
// ============================================================================

function BellIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}

function TrashIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Svg>
  );
}

function CheckIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}

function NotificationIcon({ type, priority }: { type: string; priority: string }) {
  let color = COLORS.primary;
  if (priority === 'urgent') color = COLORS.danger;
  else if (priority === 'high') color = COLORS.warning;
  else if (priority === 'medium') color = COLORS.primary;

  return (
    <View style={[styles.notificationIconContainer, { backgroundColor: color + '20' }]}>
      <Circle cx={12} cy={12} r={4} fill={color} />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  filterTabTextActive: {
    color: COLORS.card,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  markAllButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 6,
  },
  listContent: {
    paddingVertical: 12,
    flexGrow: 1,
  },
  notificationItem: {
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notificationUnread: {
    backgroundColor: COLORS.unread,
    borderColor: COLORS.primary,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  notificationIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  notificationTitleUnread: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginLeft: 8,
  },
  deleteButton: {
    padding: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationDate: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateMessage: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.card,
  },
});
