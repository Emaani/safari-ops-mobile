/**
 * Jackal Adventures Mobile SDK
 *
 * A comprehensive SDK for building mobile applications with the Jackal Adventures platform.
 * Includes Push Notifications, Messaging, Live Updates, Offline Sync, and API Services.
 *
 * @version 1.0.0
 * @author Jackal Adventures
 * @license MIT
 */

// Core SDK
export { JackalSDK, type JackalSDKConfig } from './core/JackalSDK';

// Authentication
export {
  AuthService,
  type AuthCredentials,
  type AuthUser,
  type AuthSession,
  type AuthError,
} from './auth/AuthService';

// Push Notifications
export {
  PushNotificationService,
  type PushNotificationConfig,
  type PushToken,
  type NotificationPayload,
  type NotificationHandler,
} from './notifications/PushNotificationService';

// Messaging
export {
  MessagingService,
  type Message,
  type MessageChannel,
  type MessageSubscription,
  type MessageFilter,
} from './messaging/MessagingService';

// Live Updates (Realtime Sync)
export {
  RealtimeService,
  type RealtimeChannel,
  type RealtimeEvent,
  type RealtimeSubscription,
  type RealtimeConfig,
} from './realtime/RealtimeService';

// Offline Sync
export {
  OfflineSyncService,
  type SyncStatus,
  type SyncConfig,
  type SyncQueue,
  type SyncOperation,
} from './offline/OfflineSyncService';

// API Services
export {
  APIService,
  type APIConfig,
  type APIRequest,
  type APIResponse,
  type APIError,
} from './api/APIService';

// Data Services
export {
  DashboardService,
  type DashboardData,
  type DashboardMetrics,
} from './data/DashboardService';

export {
  BookingsService,
  type Booking,
  type BookingFilter,
} from './data/BookingsService';

export {
  FleetService,
  type Vehicle,
  type FleetStatus,
} from './data/FleetService';

export {
  FinanceService,
  type Transaction,
  type FinancialSummary,
} from './data/FinanceService';

// Storage
export {
  StorageService,
  type StorageConfig,
  type StorageItem,
} from './storage/StorageService';

// Utilities
export {
  Logger,
  type LogLevel,
  type LogEntry,
} from './utils/Logger';

export {
  NetworkMonitor,
  type NetworkStatus,
  type NetworkType,
} from './utils/NetworkMonitor';

export {
  DeviceInfo,
  type DeviceDetails,
  type Platform,
} from './utils/DeviceInfo';

// Hooks (React Native specific)
export { useAuth } from './hooks/useAuth';
export { usePushNotifications } from './hooks/usePushNotifications';
export { useMessaging } from './hooks/useMessaging';
export { useRealtime } from './hooks/useRealtime';
export { useOfflineSync } from './hooks/useOfflineSync';
export { useDashboard } from './hooks/useDashboard';
export { useBookings } from './hooks/useBookings';
export { useFleet } from './hooks/useFleet';
export { useFinance } from './hooks/useFinance';

// Version
export const SDK_VERSION = '1.0.0';
export const SDK_NAME = 'Jackal Adventures Mobile SDK';
