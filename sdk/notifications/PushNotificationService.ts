/**
 * Push Notification Service
 *
 * Handles push notification registration, token management, and notification handling
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Logger } from '../utils/Logger';
import type { AuthService } from '../auth/AuthService';
import type { APIService } from '../api/APIService';

export interface PushNotificationConfig {
  easProjectId?: string;
  logger: Logger;
  auth: AuthService;
  api: APIService;
}

export interface PushToken {
  token: string;
  userId: string;
  deviceId: string;
  platform: string;
  createdAt: Date;
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
  priority?: 'default' | 'high' | 'max';
}

export type NotificationHandler = (notification: Notifications.Notification) => void;
export type NotificationResponseHandler = (response: Notifications.NotificationResponse) => void;

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class PushNotificationService {
  private config: PushNotificationConfig;
  private logger: Logger;
  private auth: AuthService;
  private api: APIService;

  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;
  private currentToken: string | null = null;

  constructor(config: PushNotificationConfig) {
    this.config = config;
    this.logger = config.logger;
    this.auth = config.auth;
    this.api = config.api;
  }

  /**
   * Initialize push notifications
   */
  public async initialize(): Promise<void> {
    this.logger.info('[PushNotifications] Initializing');

    try {
      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        this.logger.warn('[PushNotifications] Permission not granted');
        return;
      }

      // Register for push tokens
      const token = await this.registerForPushToken();
      if (token) {
        this.currentToken = token;

        // Save token to backend
        const user = await this.auth.getCurrentUser();
        if (user) {
          await this.savePushToken(user.id, token);
        }
      }

      // Set up listeners
      this.setupListeners();

      this.logger.info('[PushNotifications] Initialization complete');
    } catch (error) {
      this.logger.error('[PushNotifications] Initialization failed', error);
      throw error;
    }
  }

  /**
   * Request notification permissions
   */
  public async requestPermissions(): Promise<boolean> {
    this.logger.info('[PushNotifications] Requesting permissions');

    if (!Device.isDevice) {
      this.logger.warn('[PushNotifications] Push notifications only work on physical devices');
      return false;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        this.logger.warn('[PushNotifications] Permission denied');
        return false;
      }

      this.logger.info('[PushNotifications] Permission granted');
      return true;
    } catch (error) {
      this.logger.error('[PushNotifications] Permission request failed', error);
      return false;
    }
  }

  /**
   * Register for push token
   */
  private async registerForPushToken(): Promise<string | null> {
    this.logger.info('[PushNotifications] Registering for push token');

    try {
      const projectId = this.getProjectId();
      if (!projectId) {
        this.logger.error('[PushNotifications] No valid EAS project ID found');
        return null;
      }

      this.logger.info('[PushNotifications] Using EAS projectId:', projectId);

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;

      this.logger.info('[PushNotifications] Push token obtained:', token);
      return token;
    } catch (error) {
      this.logger.error('[PushNotifications] Token registration failed', error);
      return null;
    }
  }

  /**
   * Get EAS project ID
   */
  private getProjectId(): string | null {
    // First, check config
    if (this.config.easProjectId && this.isValidUUID(this.config.easProjectId)) {
      return this.config.easProjectId;
    }

    // Then check Constants
    try {
      const easProjectId = Constants.easConfig?.projectId;
      if (easProjectId && this.isValidUUID(easProjectId)) {
        return easProjectId;
      }

      const extraProjectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (extraProjectId && this.isValidUUID(extraProjectId)) {
        return extraProjectId;
      }
    } catch (error) {
      this.logger.error('[PushNotifications] Error reading projectId from Constants', error);
    }

    return null;
  }

  /**
   * Validate UUID format
   */
  private isValidUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') return false;

    const placeholders = ['your-expo-project-id', 'your-project-id', 'PROJECT_ID'];
    if (placeholders.includes(uuid)) return false;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Save push token to backend
   */
  private async savePushToken(userId: string, token: string): Promise<void> {
    this.logger.info('[PushNotifications] Saving push token to backend');

    try {
      await this.api.post('/push-tokens', {
        user_id: userId,
        expo_push_token: token,
        device_id: await this.getDeviceId(),
        platform: Platform.OS,
      });

      this.logger.info('[PushNotifications] Push token saved successfully');
    } catch (error) {
      this.logger.error('[PushNotifications] Error saving push token', error);
      throw error;
    }
  }

  /**
   * Get device ID
   */
  private async getDeviceId(): Promise<string> {
    // Use a combination of device info to create a unique ID
    const deviceName = Device.deviceName || 'unknown';
    const osVersion = Device.osVersion || 'unknown';
    const platform = Platform.OS;

    return `${platform}-${deviceName}-${osVersion}`.replace(/\s/g, '-');
  }

  /**
   * Setup notification listeners
   */
  private setupListeners(): void {
    this.logger.info('[PushNotifications] Setting up listeners');

    // Listener for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        this.logger.info('[PushNotifications] Notification received', notification);
        // Handle notification display or custom logic
      }
    );

    // Listener for user tapping on a notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        this.logger.info('[PushNotifications] Notification response', response);
        // Handle navigation or custom actions
      }
    );
  }

  /**
   * Add custom notification received listener
   */
  public addNotificationReceivedListener(handler: NotificationHandler): () => void {
    const subscription = Notifications.addNotificationReceivedListener(handler);
    return () => subscription.remove();
  }

  /**
   * Add custom notification response listener
   */
  public addNotificationResponseListener(handler: NotificationResponseHandler): () => void {
    const subscription = Notifications.addNotificationResponseReceivedListener(handler);
    return () => subscription.remove();
  }

  /**
   * Schedule a local notification
   */
  public async scheduleNotification(
    payload: NotificationPayload,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string> {
    this.logger.info('[PushNotifications] Scheduling notification', payload);

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          data: payload.data,
          badge: payload.badge,
          sound: payload.sound || 'default',
          priority: payload.priority || 'high',
        },
        trigger: trigger || null,
      });

      this.logger.info('[PushNotifications] Notification scheduled:', notificationId);
      return notificationId;
    } catch (error) {
      this.logger.error('[PushNotifications] Error scheduling notification', error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  public async cancelNotification(notificationId: string): Promise<void> {
    this.logger.info('[PushNotifications] Canceling notification:', notificationId);
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  /**
   * Cancel all scheduled notifications
   */
  public async cancelAllNotifications(): Promise<void> {
    this.logger.info('[PushNotifications] Canceling all notifications');
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Set app badge count
   */
  public async setBadgeCount(count: number): Promise<void> {
    this.logger.info('[PushNotifications] Setting badge count:', count);
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Get app badge count
   */
  public async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Clear app badge
   */
  public async clearBadge(): Promise<void> {
    await this.setBadgeCount(0);
  }

  /**
   * Get current push token
   */
  public getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * Refresh push token
   */
  public async refreshToken(): Promise<string | null> {
    this.logger.info('[PushNotifications] Refreshing push token');

    const token = await this.registerForPushToken();
    if (token) {
      this.currentToken = token;

      const user = await this.auth.getCurrentUser();
      if (user) {
        await this.savePushToken(user.id, token);
      }
    }

    return token;
  }

  /**
   * Clean up listeners
   */
  public cleanup(): void {
    this.logger.info('[PushNotifications] Cleaning up');

    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }

    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
  }
}
