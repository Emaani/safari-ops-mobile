import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import type { PushToken } from '../types/notification';

/**
 * Push Notification Service
 *
 * Handles device registration, push token management, and notification handling.
 * Integrates with Expo Notifications API and Supabase backend.
 */

/**
 * Configure notification behavior
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Get the EAS project ID from app configuration
 * Tries multiple sources in order of preference
 */
function getProjectId(): string | null {
  try {
    // Try easConfig first (preferred method)
    const easProjectId = Constants.easConfig?.projectId;
    if (easProjectId && isValidUUID(easProjectId)) {
      console.log('[PushNotifications] Using projectId from Constants.easConfig');
      return easProjectId;
    }

    // Fallback to expoConfig.extra.eas.projectId
    const extraProjectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (extraProjectId && isValidUUID(extraProjectId)) {
      console.log('[PushNotifications] Using projectId from Constants.expoConfig.extra.eas');
      return extraProjectId;
    }

    console.error('[PushNotifications] No valid projectId found in app configuration');
    return null;
  } catch (error) {
    console.error('[PushNotifications] Error reading projectId from configuration:', error);
    return null;
  }
}

/**
 * Validate UUID format
 */
function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }

  // Check for placeholder values
  const placeholders = ['your-expo-project-id', 'your-project-id', 'PROJECT_ID'];
  if (placeholders.includes(uuid)) {
    console.error('[PushNotifications] Placeholder projectId detected. Please configure a valid UUID in app.json');
    return false;
  }

  // Validate UUID format (8-4-4-4-12 hex characters)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isValid = uuidRegex.test(uuid);

  if (!isValid) {
    console.error('[PushNotifications] Invalid UUID format:', uuid);
  }

  return isValid;
}

/**
 * Register device for push notifications
 * Returns the Expo push token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    console.log('[PushNotifications] Registering device for push notifications...');

    // Check if running on a physical device
    if (!Device.isDevice) {
      console.warn('[PushNotifications] Push notifications only work on physical devices');
      return null;
    }

    // Get and validate project ID
    const projectId = getProjectId();
    if (!projectId) {
      console.error('[PushNotifications] Cannot register for push notifications: Missing or invalid projectId');
      console.error('[PushNotifications] Please configure a valid UUID in app.json under extra.eas.projectId');
      console.error('[PushNotifications] Run "npx eas init" to generate a project ID, or use an existing one');
      return null;
    }

    console.log('[PushNotifications] Using EAS projectId:', projectId);

    // Get existing notification permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      console.log('[PushNotifications] Requesting notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[PushNotifications] Notification permissions not granted');
      return null;
    }

    console.log('[PushNotifications] Permissions granted, getting push token...');

<<<<<<< HEAD
    // Get the Expo push token with validated project ID
=======
    // Get the Expo push token
    // Project ID is loaded from environment variable or app.json
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;

    if (!projectId || projectId === 'your-expo-project-id') {
      console.warn(
        '[PushNotifications] EXPO_PUBLIC_PROJECT_ID not configured.\n' +
        'To enable push notifications:\n' +
        '1. Create a project at https://expo.dev\n' +
        '2. Add your project ID to .env as EXPO_PUBLIC_PROJECT_ID\n' +
        '3. Update app.json extra.eas.projectId'
      );
      return null;
    }

>>>>>>> 8d0edfcad75599c0b99cbaf583b5a3805cdce6f1
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenData.data;
    console.log('[PushNotifications] Push token obtained:', token);

    // Set up notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3b82f6',
      });

      console.log('[PushNotifications] Android notification channel configured');
    }

    return token;
  } catch (error) {
    console.error('[PushNotifications] Error registering for push notifications:', error);

    // Provide helpful error messages for common issues
    if (error instanceof Error) {
      if (error.message.includes('VALIDATION_ERROR') || error.message.includes('projectId')) {
        console.error('[PushNotifications] This error is likely caused by an invalid or missing projectId');
        console.error('[PushNotifications] Please ensure app.json has a valid UUID under extra.eas.projectId');
      }
    }

    return null;
  }
}

/**
 * Save push token to database
 */
export async function savePushToken(userId: string, token: string): Promise<void> {
  try {
    console.log('[PushNotifications] Saving push token to database...');

    const deviceType = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    const deviceName = await getDeviceName();

    // Check if token already exists for this user and device
    const { data: existingTokens } = await supabase
      .from('push_tokens')
      .select('id')
      .eq('user_id', userId)
      .eq('token', token);

    if (existingTokens && existingTokens.length > 0) {
      // Update existing token
      const { error } = await supabase
        .from('push_tokens')
        .update({
          is_active: true,
          device_name: deviceName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTokens[0].id);

      if (error) {
        console.error('[PushNotifications] Error updating push token:', error);
        throw error;
      }

      console.log('[PushNotifications] Push token updated successfully');
    } else {
      // Insert new token
      const pushToken: Omit<PushToken, 'id' | 'created_at' | 'updated_at'> = {
        user_id: userId,
        token,
        device_type: deviceType,
        device_name: deviceName,
        is_active: true,
      };

      const { error } = await supabase
        .from('push_tokens')
        .insert(pushToken);

      if (error) {
        console.error('[PushNotifications] Error saving push token:', error);
        throw error;
      }

      console.log('[PushNotifications] Push token saved successfully');
    }
  } catch (error) {
    console.error('[PushNotifications] Failed to save push token:', error);
    throw error;
  }
}

/**
 * Remove push token from database (on logout)
 */
export async function removePushToken(userId: string, token: string): Promise<void> {
  try {
    console.log('[PushNotifications] Removing push token from database...');

    const { error } = await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('token', token);

    if (error) {
      console.error('[PushNotifications] Error removing push token:', error);
      throw error;
    }

    console.log('[PushNotifications] Push token removed successfully');
  } catch (error) {
    console.error('[PushNotifications] Failed to remove push token:', error);
    throw error;
  }
}

/**
 * Get device name for identification
 */
async function getDeviceName(): Promise<string> {
  try {
    const deviceName = Device.deviceName || 'Unknown Device';
    const modelName = Device.modelName || '';
    const osVersion = Device.osVersion || '';

    return `${deviceName} ${modelName} (${Platform.OS} ${osVersion})`.trim();
  } catch (error) {
    console.error('[PushNotifications] Error getting device name:', error);
    return 'Unknown Device';
  }
}

/**
 * Add notification received listener
 * Returns unsubscribe function
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): () => void {
  const subscription = Notifications.addNotificationReceivedListener(callback);
  return () => subscription.remove();
}

/**
 * Add notification response listener (when user taps notification)
 * Returns unsubscribe function
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(callback);
  return () => subscription.remove();
}

/**
 * Schedule a local notification (for testing)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: any
): Promise<string> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Show immediately
    });

    console.log('[PushNotifications] Local notification scheduled:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('[PushNotifications] Error scheduling local notification:', error);
    throw error;
  }
}

/**
 * Get notification badge count
 */
export async function getBadgeCount(): Promise<number> {
  try {
    const count = await Notifications.getBadgeCountAsync();
    return count;
  } catch (error) {
    console.error('[PushNotifications] Error getting badge count:', error);
    return 0;
  }
}

/**
 * Set notification badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('[PushNotifications] Error setting badge count:', error);
  }
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await setBadgeCount(0);
    console.log('[PushNotifications] All notifications cleared');
  } catch (error) {
    console.error('[PushNotifications] Error clearing notifications:', error);
  }
}
