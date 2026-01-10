/**
 * Notification Types and Interfaces
 *
 * Defines the structure for notifications in the Safari Ops Mobile app.
 * Synchronized with Web app notification system.
 */

export type NotificationType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_completed'
  | 'booking_cancelled'
  | 'payment_received'
  | 'payment_overdue'
  | 'cr_created'
  | 'cr_approved'
  | 'cr_rejected'
  | 'vehicle_maintenance'
  | 'vehicle_available'
  | 'system_alert'
  | 'admin_message'
  | 'general';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export type NotificationStatus = 'unread' | 'read' | 'archived';

/**
 * Main Notification Interface
 * Matches the database schema for notifications table
 */
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  data?: NotificationData;
  created_at: string;
  read_at?: string;
  expires_at?: string;
}

/**
 * Additional notification data for routing and context
 */
export interface NotificationData {
  // Related entity IDs for navigation
  booking_id?: string;
  vehicle_id?: string;
  cr_id?: string;
  transaction_id?: string;

  // Additional context
  amount?: number;
  currency?: string;
  reference?: string;

  // Deep linking
  screen?: string;
  params?: Record<string, any>;
}

/**
 * Push notification token for device registration
 */
export interface PushToken {
  id?: string;
  user_id: string;
  token: string;
  device_type: 'ios' | 'android' | 'web';
  device_name?: string;
  created_at?: string;
  updated_at?: string;
  is_active: boolean;
}

/**
 * Notification preferences for user settings
 */
export interface NotificationPreferences {
  id?: string;
  user_id: string;

  // Push notification settings
  push_enabled: boolean;

  // Notification type preferences
  booking_notifications: boolean;
  payment_notifications: boolean;
  cr_notifications: boolean;
  vehicle_notifications: boolean;
  system_notifications: boolean;
  admin_notifications: boolean;

  // Quiet hours
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string; // HH:MM format
  quiet_hours_end?: string;   // HH:MM format

  created_at?: string;
  updated_at?: string;
}

/**
 * Notification summary for badge counts
 */
export interface NotificationSummary {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
}

/**
 * Notification filter options
 */
export interface NotificationFilters {
  status?: NotificationStatus;
  type?: NotificationType;
  priority?: NotificationPriority;
  startDate?: Date;
  endDate?: Date;
}
