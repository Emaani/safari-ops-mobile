import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Text } from 'react-native';
import Svg, { Rect, Path } from 'react-native-svg';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import DashboardScreen from './src/screens/DashboardScreen';
import LoginScreen from './src/screens/LoginScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import { useNotifications } from './src/hooks/useNotifications';
import {
  registerForPushNotifications,
  savePushToken,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  setBadgeCount,
} from './src/services/notificationService';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

/**
 * Main App Component
 *
 * Wraps the entire app in AuthProvider to provide global authentication state.
 * Shows LoginScreen when user is not authenticated.
 * Shows tab navigation when user is authenticated.
 */
export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </AuthProvider>
  );
}

/**
 * App Navigator Component
 *
 * Handles routing based on authentication state.
 * Must be inside AuthProvider to access auth context.
 */
function AppNavigator() {
  const { isAuthenticated, loading, user } = useAuth();
  const notificationListener = useRef<(() => void) | null>(null);
  const responseListener = useRef<(() => void) | null>(null);

  // Initialize push notifications when authenticated
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    console.log('[App] Initializing push notifications for user:', user.id);

    // Register for push notifications
    registerForPushNotifications()
      .then((token) => {
        if (token) {
          console.log('[App] Push token obtained, saving to database');
          return savePushToken(user.id, token);
        }
      })
      .catch((error) => {
        console.error('[App] Error setting up push notifications:', error);
      });

    // Listen for notifications while app is foregrounded
    notificationListener.current = addNotificationReceivedListener((notification) => {
      console.log('[App] Notification received:', notification);
    });

    // Listen for user tapping notification
    responseListener.current = addNotificationResponseListener((response) => {
      console.log('[App] Notification response:', response);
      // Handle navigation based on notification data
      const data = response.notification.request.content.data;
      if (data?.screen) {
        // Navigation will be handled by NotificationsScreen
      }
    });

    // Cleanup
    return () => {
      if (notificationListener.current) {
        notificationListener.current();
      }
      if (responseListener.current) {
        responseListener.current();
      }
    };
  }, [isAuthenticated, user]);

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Show main app navigation if authenticated
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#ffffff',
            elevation: 2,
            shadowOpacity: 0.1,
          },
          headerTintColor: '#111827',
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabNavigator}
          options={({ navigation }) => ({
            title: 'Safari Ops',
            headerRight: () => <NotificationBell navigation={navigation} userId={user?.id || ''} />,
          })}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{
            title: 'Notifications',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/**
 * Main Tab Navigator
 */
function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          backgroundColor: '#ffffff',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <DashboardIcon color={color} size={size} />
          ),
        }}
      />
      {/* Future tabs can be added here:
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen name="Fleet" component={FleetScreen} />
      <Tab.Screen name="Finance" component={FinanceScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
      */}
    </Tab.Navigator>
  );
}

/**
 * Notification Bell Icon with Badge
 */
function NotificationBell({ navigation, userId }: { navigation: any; userId: string }) {
  const { summary } = useNotifications(userId);

  // Update app badge count
  useEffect(() => {
    setBadgeCount(summary.unread);
  }, [summary.unread]);

  return (
    <TouchableOpacity
      style={styles.notificationButton}
      onPress={() => navigation.navigate('Notifications')}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <BellIcon size={24} color="#111827" />
      {summary.unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {summary.unread > 99 ? '99+' : summary.unread}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// Dashboard tab icon
function DashboardIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="2" />
      <Rect x="14" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="2" />
      <Rect x="3" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="2" />
      <Rect x="14" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

// Bell icon for notifications
function BellIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  notificationButton: {
    position: 'relative',
    marginRight: 16,
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
